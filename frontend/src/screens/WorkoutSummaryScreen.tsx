import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Polyline, UrlTile } from '../components/NativeMap';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { formatTime } from '../constants/workoutUtils';
import { useWorkout } from '../contexts/WorkoutContext';
import { useAuth } from '../contexts/AuthContext';
import { saveWorkout, getUpcomingActivities, linkWorkoutToActivity } from '../services/api';
import { useProgram } from '../contexts/ProgramContext';
import { HROverTimeChart, PaceOverTimeChart, SpeedOverTimeChart, CadenceChart } from '../components/WorkoutCharts';
import type { WorkoutResponse } from '../services/api';
import { savePendingWorkout } from '../services/offlineStorage';
import {
  buildFinalGPSPayload,
  formatPaceSecPerKm,
  formatSpeedKph,
  formatDistanceKm,
  isRunSport,
  computeHRZoneDistribution,
  HR_ZONE_COLORS,
  computeEffortScore,
  computeKmSplits,
} from '../services/gpsUtils';
import type { Lap, HRZone } from '../types/gps';
import { isPremium } from '../utils/premium';
import { PremiumStatsCard } from '../components/PremiumStatsCard';
import { EffortScoreCard } from '../components/EffortScoreCard';
import { SplitsCard } from '../components/SplitsCard';
import type { ThemeColors } from '../constants/colors';

export default function WorkoutSummaryScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { activeGPSWorkout, clearGPSWorkout } = useWorkout();
  const { user } = useAuth();
  const { notifyProgramDataChanged } = useProgram();
  const maxHR = user?.max_heart_rate ?? 185;
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);

  const gpsPayload = useMemo(() => {
    if (!activeGPSWorkout) return null;
    const finishedAt = activeGPSWorkout.finishedAt ?? new Date();
    return buildFinalGPSPayload({
      activityType: activeGPSWorkout.activityType,
      points: activeGPSWorkout.points,
      laps: activeGPSWorkout.laps,
      hrReadings: activeGPSWorkout.hrReadings,
      cadenceReadings: activeGPSWorkout.cadenceReadings,
      totalDistanceM: activeGPSWorkout.totalDistanceM,
      autoPausedDurationSec: activeGPSWorkout.autoPausedDurationSec,
      startedAt: activeGPSWorkout.startedAt,
      finishedAt,
      hrDeviceName: activeGPSWorkout.hrDeviceName,
    });
  }, [activeGPSWorkout]);

  const effortData = useMemo(() => {
    if (!gpsPayload?.hrData || gpsPayload.hrData.readings.length <= 1) return null;
    return computeEffortScore(gpsPayload.hrData.readings, maxHR, gpsPayload.routeData.duration_sec);
  }, [gpsPayload, maxHR]);

  const splitsData = useMemo(() => {
    if (!activeGPSWorkout || !gpsPayload || gpsPayload.routeData.distance_km < 1) return null;
    return computeKmSplits(activeGPSWorkout.points, gpsPayload.hrData?.readings);
  }, [activeGPSWorkout, gpsPayload]);

  if (!activeGPSWorkout || !gpsPayload) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary, fontSize: 15 }}>No workout data available.</Text>
      </View>
    );
  }

  const workout = activeGPSWorkout;
  const isRun = isRunSport(workout.activityType);
  const finishedAt = workout.finishedAt ?? new Date();
  const { routeData, summaryData, hrData } = gpsPayload;

  const totalElapsed = routeData.duration_sec;
  let bestLap = null;
  if (workout.laps.length > 0) {
    bestLap = isRun
      ? workout.laps.reduce((best, l) => (l.avg_pace_sec_per_km > 0 && l.avg_pace_sec_per_km < best.avg_pace_sec_per_km ? l : best))
      : workout.laps.reduce((best, l) => (l.avg_speed_kph > best.avg_speed_kph ? l : best));
  }

  const hrZoneDist = hrData && hrData.readings.length > 0
    ? computeHRZoneDistribution(hrData.readings, maxHR)
    : null;
  const hrZoneTotalSec = hrZoneDist
    ? (Object.values(hrZoneDist) as number[]).reduce((s, v) => s + v, 0)
    : 0;

  const userIsPremium = isPremium(user);

  const polylineCoords = workout.points.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  const firstPoint = workout.points[0];
  const lastPoint = workout.points[workout.points.length - 1];

  const mapRegion =
    firstPoint && lastPoint
      ? {
          latitude: (firstPoint.lat + lastPoint.lat) / 2,
          longitude: (firstPoint.lng + lastPoint.lng) / 2,
          latitudeDelta: Math.abs(firstPoint.lat - lastPoint.lat) * 2 + 0.01,
          longitudeDelta: Math.abs(firstPoint.lng - lastPoint.lng) * 2 + 0.01,
        }
      : { latitude: 51.5074, longitude: -0.1278, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  async function handleSave() {
    setSaving(true);
    const workoutPayload = {
      activity_type: workout.activityType,
      recorded_data: summaryData as Record<string, any>,
      gps_route: routeData as unknown as Record<string, any>,
      heart_rate_data: hrData as Record<string, any> | undefined,
      source: 'gps' as const,
      started_at: workout.startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      scheduled_activity_id: workout.scheduledActivityId,
      notes: notes.trim() || undefined,
    };

    const netState = await NetInfo.fetch();
    let savedWorkout: WorkoutResponse | null = null;
    if (netState.isConnected) {
      try {
        savedWorkout = await saveWorkout(workoutPayload);
      } catch {
        await saveOffline(workoutPayload);
      }
    } else {
      await saveOffline(workoutPayload);
    }

    setSaving(false);
    notifyProgramDataChanged();

    // Navigate away BEFORE clearing workout data to avoid a flash of the empty state
    if (savedWorkout) {
      navigation.getParent()?.navigate('Home');
    } else {
      navigation.navigate('History');
    }

    clearGPSWorkout();

    // Offer to link to today's scheduled activity if not already linked
    if (savedWorkout && !workout.scheduledActivityId) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const activities = await getUpcomingActivities();
        const todayActivity = activities.find((a) => a.date === today);
        if (todayActivity) {
          const label = todayActivity.activity_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          Alert.alert(
            'Link to Program?',
            `Link this workout to your "${label}" activity?`,
            [
              { text: 'Skip', style: 'cancel' },
              { text: 'Link', onPress: () => linkWorkoutToActivity(savedWorkout!.id, todayActivity.id) },
            ]
          );
        }
      } catch { /* ignore — linking is best-effort */ }
    }
  }

  async function saveOffline(payload: Record<string, any>) {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await savePendingWorkout({
      id,
      activity_type: payload.activity_type,
      recorded_data: JSON.stringify(payload.recorded_data),
      gps_route: payload.gps_route ? JSON.stringify(payload.gps_route) : undefined,
      heart_rate_data: payload.heart_rate_data ? JSON.stringify(payload.heart_rate_data) : undefined,
      source: payload.source,
      started_at: payload.started_at,
      finished_at: payload.finished_at,
      scheduled_activity_id: payload.scheduled_activity_id,
      notes: payload.notes,
    });
    setSavedOffline(true);
  }

  function handleDiscard() {
    Alert.alert('Discard Workout?', 'All workout data will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          clearGPSWorkout();
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={[styles.flex, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {/* Route map */}
        {workout.points.length > 1 ? (
          <MapView
            style={styles.map}
            region={mapRegion}
            scrollEnabled={false}
            zoomEnabled={false}
            mapType={Platform.OS === 'android' ? 'none' : 'standard'}
          >
            {Platform.OS === 'android' && (
              <UrlTile
                urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                maximumZ={19}
                flipY={false}
              />
            )}
            <Polyline
              coordinates={polylineCoords}
              strokeColor={colors.primary}
              strokeWidth={4}
            />
          </MapView>
        ) : (
          <View style={[styles.noMapPlaceholder, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="map-outline" size={40} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>No route recorded</Text>
          </View>
        )}

        <View style={styles.body}>
          {/* Activity header */}
          <Text style={[styles.activityTitle, { color: colors.textPrimary }]}>
            {workout.activityType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </Text>
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {workout.startedAt.toLocaleDateString(undefined, {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
          </Text>

          {savedOffline && (
            <View style={[styles.offlineBanner, { backgroundColor: colors.warning + '20', }]}>
              <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
              <Text style={[styles.offlineBannerText, { color: colors.textSecondary }]}>Saved offline — will sync when connected</Text>
            </View>
          )}

          {/* Stats grid */}
          <View style={styles.statsGrid}>
            <StatCard
              label="Distance"
              value={`${formatDistanceKm(routeData.distance_km * 1000)} km`}
              colors={colors}
            />
            <StatCard label="Time" value={formatTime(Math.round(totalElapsed))} colors={colors} />
            {isRun && (
              <StatCard
                label="Avg Pace"
                value={formatPaceSecPerKm(routeData.avg_pace_sec_per_km)}
                unit="/km"
                colors={colors}
              />
            )}
            {!isRun && (
              <StatCard
                label="Avg Speed"
                value={formatSpeedKph(routeData.avg_speed_kph)}
                unit="km/h"
                colors={colors}
              />
            )}
            <StatCard label="Elev Gain" value={`+${routeData.elevation_gain_m} m`} colors={colors} />
            {bestLap && isRun && (
              <StatCard
                label="Best Lap"
                value={formatPaceSecPerKm(bestLap.avg_pace_sec_per_km)}
                unit="/km"
                colors={colors}
              />
            )}
            {bestLap && !isRun && (
              <StatCard
                label="Best Lap"
                value={formatSpeedKph(bestLap.avg_speed_kph)}
                unit="km/h"
                colors={colors}
              />
            )}
            {routeData.avg_hr && (
              <StatCard label="Avg HR" value={`${routeData.avg_hr}`} unit="bpm" colors={colors} />
            )}
            {routeData.max_hr && (
              <StatCard label="Max HR" value={`${routeData.max_hr}`} unit="bpm" colors={colors} />
            )}
            {routeData.avg_cadence && (
              <StatCard label="Avg Cadence" value={`${routeData.avg_cadence}`} unit="spm" colors={colors} />
            )}
            {routeData.max_cadence && (
              <StatCard label="Max Cadence" value={`${routeData.max_cadence}`} unit="spm" colors={colors} />
            )}
            <StatCard label="Laps" value={`${workout.laps.length}`} colors={colors} />
          </View>

          {/* HR Zone bar */}
          {hrZoneDist && hrZoneTotalSec > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Heart Rate Zones</Text>
              <View style={styles.hrZoneBar}>
                {([1, 2, 3, 4, 5] as HRZone[]).map((zone) => {
                  const pct = hrZoneDist[zone] / hrZoneTotalSec;
                  return pct > 0 ? (
                    <View
                      key={zone}
                      style={[styles.hrZoneSegment, { flex: pct, backgroundColor: HR_ZONE_COLORS[zone] }]}
                    />
                  ) : null;
                })}
              </View>
              <View style={styles.hrZoneLegend}>
                {([1, 2, 3, 4, 5] as HRZone[]).map((zone) => (
                  <View key={zone} style={styles.hrZoneLegendItem}>
                    <View style={[styles.hrZoneDot, { backgroundColor: HR_ZONE_COLORS[zone] }]} />
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      Z{zone} {Math.round((hrZoneDist[zone] / hrZoneTotalSec) * 100)}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Charts */}
          {hrData && hrData.readings.length > 5 && (
            <HROverTimeChart readings={hrData.readings} maxHR={maxHR} />
          )}

          {workout.points.length > 10 && isRun && (
            <PaceOverTimeChart points={workout.points} />
          )}

          {workout.points.length > 10 && !isRun && (
            <SpeedOverTimeChart points={workout.points} />
          )}

          {hrData?.cadence_readings && hrData.cadence_readings.length > 5 && (
            <CadenceChart readings={hrData.cadence_readings} />
          )}

          {/* Lap splits */}
          {workout.laps.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Lap Splits</Text>
              <View style={[styles.lapHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.lapCell, styles.lapCellLabel, { color: colors.textSecondary }]}>Lap</Text>
                <Text style={[styles.lapCell, styles.lapCellLabel, { color: colors.textSecondary }]}>Dist</Text>
                <Text style={[styles.lapCell, styles.lapCellLabel, { color: colors.textSecondary }]}>Time</Text>
                <Text style={[styles.lapCell, styles.lapCellLabel, { color: colors.textSecondary }]}>{isRun ? 'Pace' : 'Speed'}</Text>
                {workout.laps.some((l) => l.avg_hr) && (
                  <Text style={[styles.lapCell, styles.lapCellLabel, { color: colors.textSecondary }]}>HR</Text>
                )}
              </View>
              <FlatList
                data={workout.laps}
                keyExtractor={(item) => String(item.lap_number)}
                scrollEnabled={false}
                renderItem={({ item: lap }) => (
                  <LapRow lap={lap} isRun={isRun} showHR={workout.laps.some((l) => l.avg_hr)} colors={colors} />
                )}
              />
            </View>
          )}

          {/* Per-KM Splits (free) */}
          {splitsData && splitsData.splits.length > 0 && <SplitsCard data={splitsData} />}

          {/* Premium Analytics */}
          {effortData && (
            <PremiumStatsCard isPremium={userIsPremium} title="Advanced Analytics">
              <EffortScoreCard data={effortData} />
            </PremiumStatsCard>
          )}

          {/* Notes */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notes</Text>
            <TextInput
              style={[styles.notesInput, { backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
              multiline
              placeholder="How did it feel? Any observations..."
              placeholderTextColor={colors.textSecondary}
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          {/* Buttons */}
          <Pressable
            style={[styles.saveBtn, { backgroundColor: colors.primary }, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={[styles.saveBtnText, { color: colors.surface }]}>{saving ? 'Saving...' : 'Save Workout'}</Text>
          </Pressable>
          <Pressable style={[styles.discardBtn, { borderColor: colors.border }]} onPress={handleDiscard}>
            <Text style={{ color: colors.textSecondary, fontSize: 15 }}>Discard</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StatCard({ label, value, unit, colors }: { label: string; value: string; unit?: string; colors: ThemeColors }) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
      <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary }}>{value}</Text>
        {unit && <Text style={{ fontSize: 12, color: colors.textSecondary }}>{unit}</Text>}
      </View>
    </View>
  );
}

function LapRow({ lap, isRun, showHR, colors }: { lap: Lap; isRun: boolean; showHR: boolean; colors: ThemeColors }) {
  const lapColor = isRun
    ? getLapPaceColor(lap.avg_pace_sec_per_km, colors)
    : getLapSpeedColor(lap.avg_speed_kph, colors);
  return (
    <View style={[styles.lapRow, { borderLeftColor: lapColor, borderLeftWidth: 3, borderBottomColor: colors.surfaceAlt }]}>
      <Text style={[styles.lapCell, { color: colors.textPrimary }]}>{lap.lap_number}</Text>
      <Text style={[styles.lapCell, { color: colors.textPrimary }]}>{(lap.distance_m / 1000).toFixed(2)} km</Text>
      <Text style={[styles.lapCell, { color: colors.textPrimary }]}>{formatTime(Math.round(lap.duration_sec))}</Text>
      <Text style={[styles.lapCell, { color: lapColor, fontWeight: '600' }]}>
        {isRun
          ? formatPaceSecPerKm(lap.avg_pace_sec_per_km)
          : `${formatSpeedKph(lap.avg_speed_kph)} km/h`}
      </Text>
      {showHR && (
        <Text style={[styles.lapCell, { color: colors.textPrimary }]}>{lap.avg_hr ? `${lap.avg_hr}` : '\u2014'}</Text>
      )}
    </View>
  );
}

// Simple 3-tier coloring for lap rows — green fast, yellow medium, red slow
function getLapPaceColor(pace: number, colors: ThemeColors): string {
  if (pace <= 0) return colors.textSecondary;
  if (pace < 300) return colors.success;  // < 5:00/km — fast
  if (pace < 420) return colors.warning;  // < 7:00/km — medium
  return colors.error;                    // slow
}

function getLapSpeedColor(speed: number, colors: ThemeColors): string {
  if (speed <= 0) return colors.textSecondary;
  if (speed > 30) return colors.success;
  if (speed > 20) return colors.warning;
  return colors.error;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  map: { height: 220, width: '100%' },
  noMapPlaceholder: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  body: { padding: 16 },
  activityTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 2,
  },
  dateText: { fontSize: 14, marginBottom: 16 },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  offlineBannerText: { fontSize: 13, flex: 1 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    borderRadius: 12,
    padding: 12,
    minWidth: '47%',
    flex: 1,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  // HR Zone bar
  hrZoneBar: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  hrZoneSegment: { height: 16 },
  hrZoneLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hrZoneLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hrZoneDot: { width: 10, height: 10, borderRadius: 5 },
  // Lap table
  lapHeader: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  lapRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingLeft: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lapCell: { flex: 1, fontSize: 13, fontVariant: ['tabular-nums'] },
  lapCellLabel: { fontSize: 11, fontWeight: '600' },
  // Notes
  notesInput: {
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  // Buttons
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700' },
  discardBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
});
