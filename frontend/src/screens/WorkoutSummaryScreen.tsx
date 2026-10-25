import { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { RouteMapPreview } from '../components/RouteMapPreview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { formatTime } from '../constants/workoutUtils';
import { useWorkout } from '../contexts/WorkoutContext';
import { useAuth } from '../contexts/AuthContext';
import { useWorkoutSummarySave } from '../hooks/useWorkoutSummarySave';
import {
  HRZonesSection,
  SummaryActions,
  SummaryHeader,
  SummaryNotes,
  SummaryStatCard as StatCard,
  SummarySection,
  SummaryStatGrid,
  lapTableStyles,
} from '../components/WorkoutSummaryParts';
import { HROverTimeChart, PaceOverTimeChart, SpeedOverTimeChart, CadenceChart } from '../components/WorkoutCharts';
import { activeElapsedSec } from '../utils/workoutDuration';
import {
  buildFinalGPSPayload,
  closeFinalLap,
  formatPaceSecPerKm,
  formatSpeedKph,
  formatDistanceKm,
  isRunSport,
  isCyclingSport,
  computeEffortScore,
  computeKmSplits,
  cadenceUnit,
  computeCyclingDerivedStats,
  hasRecordedLaps,
} from '../services/gpsUtils';
import type { Lap } from '../types/gps';
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
  const maxHR = user?.max_heart_rate ?? 185;
  const flow = useWorkoutSummarySave({ navigation, clearWorkout: clearGPSWorkout });
  const [notes, setNotes] = useState('');

  const gpsPayload = useMemo(() => {
    if (!activeGPSWorkout) return null;
    const finishedAtMs = (activeGPSWorkout.finishedAt ?? new Date()).getTime();
    return buildFinalGPSPayload({
      activityType: activeGPSWorkout.activityType,
      points: activeGPSWorkout.points,
      // Live laps stop at the last Lap press; close the remainder into a final lap.
      laps: closeFinalLap(
        activeGPSWorkout.points,
        activeGPSWorkout.laps,
        activeGPSWorkout.lapStartIndex,
        activeGPSWorkout.hrReadings,
      ),
      hrReadings: activeGPSWorkout.hrReadings,
      cadenceReadings: activeGPSWorkout.cadenceReadings,
      totalDistanceM: activeGPSWorkout.totalDistanceM,
      durationSec: activeElapsedSec(activeGPSWorkout, finishedAtMs),
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
  const isCycling = isCyclingSport(workout.activityType);
  const finishedAt = workout.finishedAt ?? new Date();
  const { routeData, summaryData, hrData } = gpsPayload;

  const totalElapsed = routeData.duration_sec;
  const { vamMetersPerHour, energyKJ } = computeCyclingDerivedStats({
    durationSec: totalElapsed,
    elevationGainM: isCycling ? routeData.elevation_gain_m : 0,
    avgPower: routeData.avg_power,
  });
  // Only laps the user pressed Lap for (plus the closed final lap).
  const laps = hasRecordedLaps(routeData.laps) ? routeData.laps : [];
  const lapsHaveHR = laps.some((l) => l.avg_hr);
  let bestLap = null;
  if (laps.length > 0) {
    bestLap = isRun
      ? laps.reduce((best, l) => (l.avg_pace_sec_per_km > 0 && l.avg_pace_sec_per_km < best.avg_pace_sec_per_km ? l : best))
      : laps.reduce((best, l) => (l.avg_speed_kph > best.avg_speed_kph ? l : best));
  }

  const userIsPremium = isPremium(user);

  function handleSave() {
    void flow.save({
      activity_type: workout.activityType,
      recorded_data: summaryData as Record<string, any>,
      gps_route: routeData as unknown as Record<string, any>,
      heart_rate_data: hrData as Record<string, any> | undefined,
      source: 'gps',
      started_at: workout.startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      paused_duration_sec: workout.pausedDurationSec,
      scheduled_activity_id: workout.scheduledActivityId,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={[styles.flex, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {/* Route map */}
        {workout.points.length > 1 ? (
          <RouteMapPreview gpsRoute={{ points: workout.points }} style={styles.map} />
        ) : (
          <View style={[styles.noMapPlaceholder, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="map-outline" size={40} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>No route recorded</Text>
          </View>
        )}

        <View style={styles.body}>
          <SummaryHeader activityType={workout.activityType} startedAt={workout.startedAt} />

          {/* Stats grid */}
          <SummaryStatGrid>
            <StatCard
              label="Distance"
              value={`${formatDistanceKm(routeData.distance_km * 1000)} km`}
            />
            <StatCard label="Time" value={formatTime(Math.floor(totalElapsed))} />
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
              <StatCard label="Avg Cadence" value={`${routeData.avg_cadence}`} unit={cadenceUnit(workout.activityType)} />
            )}
            {routeData.max_cadence && (
              <StatCard label="Max Cadence" value={`${routeData.max_cadence}`} unit={cadenceUnit(workout.activityType)} />
            )}
            {routeData.avg_power && (
              <StatCard label="Avg Power" value={`${routeData.avg_power}`} unit="W" />
            )}
            {routeData.max_power && (
              <StatCard label="Max Power" value={`${routeData.max_power}`} unit="W" />
            )}
            {energyKJ > 0 && (
              <StatCard label="Energy" value={`${energyKJ}`} unit="kJ" />
            )}
            {vamMetersPerHour > 0 && (
              <StatCard label="VAM" value={`${vamMetersPerHour}`} unit="m/h" />
            )}
            {laps.length > 0 && (
              <StatCard label="Laps" value={`${laps.length}`} />
            )}
          </SummaryStatGrid>

          {hrData && <HRZonesSection readings={hrData.readings} maxHR={maxHR} />}

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
            <CadenceChart readings={hrData.cadence_readings} activityType={workout.activityType} />
          )}

          {/* Lap splits */}
          {laps.length > 0 && (
            <SummarySection title="Lap Splits">
              <View style={[lapTableStyles.header, { borderBottomColor: colors.border }]}>
                {['Lap', 'Dist', 'Time', isRun ? 'Pace' : 'Speed', ...(lapsHaveHR ? ['HR'] : [])].map((title) => (
                  <Text key={title} style={[lapTableStyles.cell, lapTableStyles.label, { color: colors.textSecondary }]}>
                    {title}
                  </Text>
                ))}
              </View>
              <FlatList
                data={laps}
                keyExtractor={(item) => String(item.lap_number)}
                scrollEnabled={false}
                renderItem={({ item: lap }) => (
                  <LapRow lap={lap} isRun={isRun} showHR={lapsHaveHR} colors={colors} />
                )}
              />
            </SummarySection>
          )}

          {/* Per-KM Splits (free) */}
          {splitsData && splitsData.splits.length > 0 && <SplitsCard data={splitsData} />}

          {/* Pre-save effort preview — once saved, PostWorkoutReview shows the full server analytics */}
          {effortData && !flow.savedWorkoutId && (
            <PremiumStatsCard isPremium={userIsPremium} title="Analytics">
              <EffortScoreCard data={effortData} />
            </PremiumStatsCard>
          )}

          <SummaryNotes value={notes} onChange={setNotes} />

          <SummaryActions
            flow={flow}
            onSave={handleSave}
            activityType={workout.activityType}
            scheduledActivityId={workout.scheduledActivityId}
            hasSensorData
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LapRow({ lap, isRun, showHR, colors }: { lap: Lap; isRun: boolean; showHR: boolean; colors: ThemeColors }) {
  const lapColor = isRun
    ? getLapPaceColor(lap.avg_pace_sec_per_km, colors)
    : getLapSpeedColor(lap.avg_speed_kph, colors);
  return (
    <View style={[lapTableStyles.row, { borderLeftColor: lapColor, borderBottomColor: colors.surfaceAlt }]}>
      <Text style={[lapTableStyles.cell, { color: colors.textPrimary }]}>{lap.lap_number}</Text>
      <Text style={[lapTableStyles.cell, { color: colors.textPrimary }]}>{(lap.distance_m / 1000).toFixed(2)} km</Text>
      <Text style={[lapTableStyles.cell, { color: colors.textPrimary }]}>{formatTime(Math.round(lap.duration_sec))}</Text>
      <Text style={[lapTableStyles.cell, { color: lapColor, fontWeight: '600' }]}>
        {isRun
          ? formatPaceSecPerKm(lap.avg_pace_sec_per_km)
          : `${formatSpeedKph(lap.avg_speed_kph)} km/h`}
      </Text>
      {showHR && (
        <Text style={[lapTableStyles.cell, { color: colors.textPrimary }]}>{lap.avg_hr ? `${lap.avg_hr}` : '\u2014'}</Text>
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
  map: { height: 220, width: '100%', borderRadius: 0 },
  noMapPlaceholder: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  body: { padding: 16 },
});
