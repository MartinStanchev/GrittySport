import { useState } from 'react';
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
import { Colors } from '../constants/colors';
import { formatTime } from '../constants/workoutUtils';
import { useWorkout } from '../contexts/WorkoutContext';
import { useAuth } from '../contexts/AuthContext';
import { saveWorkout, getUpcomingActivities, linkWorkoutToActivity } from '../services/api';
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
} from '../services/gpsUtils';
import type { Lap, HRZone } from '../types/gps';

export default function WorkoutSummaryScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { activeGPSWorkout, clearGPSWorkout } = useWorkout();
  const { user } = useAuth();
  const maxHR = user?.max_heart_rate ?? 185;
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);

  if (!activeGPSWorkout) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No workout data available.</Text>
      </View>
    );
  }

  const workout = activeGPSWorkout;
  const isRun = isRunSport(workout.activityType);
  const finishedAt = workout.finishedAt ?? new Date();

  const { routeData, summaryData, hrData } = buildFinalGPSPayload({
    activityType: workout.activityType,
    points: workout.points,
    laps: workout.laps,
    hrReadings: workout.hrReadings,
    cadenceReadings: workout.cadenceReadings,
    totalDistanceM: workout.totalDistanceM,
    autoPausedDurationSec: workout.autoPausedDurationSec,
    startedAt: workout.startedAt,
    finishedAt,
    hrDeviceName: workout.hrDeviceName,
  });

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
    clearGPSWorkout();
    navigation.navigate('History');

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
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.flex} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
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
              strokeColor={Colors.primary}
              strokeWidth={4}
            />
          </MapView>
        ) : (
          <View style={styles.noMapPlaceholder}>
            <Ionicons name="map-outline" size={40} color={Colors.textSecondary} />
            <Text style={styles.noMapText}>No route recorded</Text>
          </View>
        )}

        <View style={styles.body}>
          {/* Activity header */}
          <Text style={styles.activityTitle}>
            {workout.activityType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </Text>
          <Text style={styles.dateText}>
            {workout.startedAt.toLocaleDateString(undefined, {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
          </Text>

          {savedOffline && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline-outline" size={16} color="#856404" />
              <Text style={styles.offlineBannerText}>Saved offline — will sync when connected</Text>
            </View>
          )}

          {/* Stats grid */}
          <View style={styles.statsGrid}>
            <StatCard
              label="Distance"
              value={`${formatDistanceKm(routeData.distance_km * 1000)} km`}
            />
            <StatCard label="Time" value={formatTime(Math.round(totalElapsed))} />
            {isRun && (
              <StatCard
                label="Avg Pace"
                value={formatPaceSecPerKm(routeData.avg_pace_sec_per_km)}
                unit="/km"
              />
            )}
            {!isRun && (
              <StatCard
                label="Avg Speed"
                value={formatSpeedKph(routeData.avg_speed_kph)}
                unit="km/h"
              />
            )}
            <StatCard label="Elev Gain" value={`+${routeData.elevation_gain_m} m`} />
            {bestLap && isRun && (
              <StatCard
                label="Best Lap"
                value={formatPaceSecPerKm(bestLap.avg_pace_sec_per_km)}
                unit="/km"
              />
            )}
            {bestLap && !isRun && (
              <StatCard
                label="Best Lap"
                value={formatSpeedKph(bestLap.avg_speed_kph)}
                unit="km/h"
              />
            )}
            {routeData.avg_hr && (
              <StatCard label="Avg HR" value={`${routeData.avg_hr}`} unit="bpm" />
            )}
            {routeData.max_hr && (
              <StatCard label="Max HR" value={`${routeData.max_hr}`} unit="bpm" />
            )}
            {routeData.avg_cadence && (
              <StatCard label="Avg Cadence" value={`${routeData.avg_cadence}`} unit="spm" />
            )}
            {routeData.max_cadence && (
              <StatCard label="Max Cadence" value={`${routeData.max_cadence}`} unit="spm" />
            )}
            <StatCard label="Laps" value={`${workout.laps.length}`} />
          </View>

          {/* HR Zone bar */}
          {hrZoneDist && hrZoneTotalSec > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Heart Rate Zones</Text>
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
                    <Text style={styles.hrZoneLegendText}>
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
              <Text style={styles.sectionTitle}>Lap Splits</Text>
              <View style={styles.lapHeader}>
                <Text style={[styles.lapCell, styles.lapCellLabel]}>Lap</Text>
                <Text style={[styles.lapCell, styles.lapCellLabel]}>Dist</Text>
                <Text style={[styles.lapCell, styles.lapCellLabel]}>Time</Text>
                <Text style={[styles.lapCell, styles.lapCellLabel]}>{isRun ? 'Pace' : 'Speed'}</Text>
                {workout.laps.some((l) => l.avg_hr) && (
                  <Text style={[styles.lapCell, styles.lapCellLabel]}>HR</Text>
                )}
              </View>
              <FlatList
                data={workout.laps}
                keyExtractor={(item) => String(item.lap_number)}
                scrollEnabled={false}
                renderItem={({ item: lap }) => (
                  <LapRow lap={lap} isRun={isRun} showHR={workout.laps.some((l) => l.avg_hr)} />
                )}
              />
            </View>
          )}

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              multiline
              placeholder="How did it feel? Any observations..."
              placeholderTextColor={Colors.textSecondary}
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          {/* Buttons */}
          <Pressable
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Workout'}</Text>
          </Pressable>
          <Pressable style={styles.discardBtn} onPress={handleDiscard}>
            <Text style={styles.discardBtnText}>Discard</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StatCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {unit && <Text style={styles.statUnit}>{unit}</Text>}
      </View>
    </View>
  );
}

function LapRow({ lap, isRun, showHR }: { lap: Lap; isRun: boolean; showHR: boolean }) {
  const lapColor = isRun
    ? getLapPaceColor(lap.avg_pace_sec_per_km)
    : getLapSpeedColor(lap.avg_speed_kph);
  return (
    <View style={[styles.lapRow, { borderLeftColor: lapColor, borderLeftWidth: 3 }]}>
      <Text style={styles.lapCell}>{lap.lap_number}</Text>
      <Text style={styles.lapCell}>{(lap.distance_m / 1000).toFixed(2)} km</Text>
      <Text style={styles.lapCell}>{formatTime(Math.round(lap.duration_sec))}</Text>
      <Text style={[styles.lapCell, { color: lapColor, fontWeight: '600' }]}>
        {isRun
          ? formatPaceSecPerKm(lap.avg_pace_sec_per_km)
          : `${formatSpeedKph(lap.avg_speed_kph)} km/h`}
      </Text>
      {showHR && (
        <Text style={styles.lapCell}>{lap.avg_hr ? `${lap.avg_hr}` : '—'}</Text>
      )}
    </View>
  );
}

// Simple 3-tier coloring for lap rows — green fast, yellow medium, red slow
function getLapPaceColor(pace: number): string {
  if (pace <= 0) return Colors.textSecondary;
  if (pace < 300) return '#4CAF50';  // < 5:00/km — fast
  if (pace < 420) return '#FFC107';  // < 7:00/km — medium
  return '#F44336';                  // slow
}

function getLapSpeedColor(speed: number): string {
  if (speed <= 0) return Colors.textSecondary;
  if (speed > 30) return '#4CAF50';
  if (speed > 20) return '#FFC107';
  return '#F44336';
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Colors.textSecondary, fontSize: 15 },
  map: { height: 220, width: '100%' },
  noMapPlaceholder: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8E8E8',
    gap: 8,
  },
  noMapText: { color: Colors.textSecondary, fontSize: 14 },
  body: { padding: 16 },
  activityTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  dateText: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF3CD',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  offlineBannerText: { fontSize: 13, color: '#856404', flex: 1 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    minWidth: '47%',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginBottom: 4 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  statValue: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  statUnit: { fontSize: 12, color: Colors.textSecondary },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
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
  hrZoneLegendText: { fontSize: 11, color: Colors.textSecondary },
  // Lap table
  lapHeader: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
    marginBottom: 4,
  },
  lapRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingLeft: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  lapCell: { flex: 1, fontSize: 13, color: Colors.textPrimary, fontVariant: ['tabular-nums'] },
  lapCellLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  // Notes
  notesInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    fontSize: 14,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
  },
  // Buttons
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  discardBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  discardBtnText: { color: Colors.textSecondary, fontSize: 15 },
});
