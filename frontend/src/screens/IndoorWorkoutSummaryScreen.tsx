import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useWorkout } from '../contexts/WorkoutContext';
import { formatTime } from '../constants/workoutUtils';
import { useWorkoutSummarySave } from '../hooks/useWorkoutSummarySave';
import {
  HRZonesSection,
  SummaryActions,
  SummaryHeader,
  SummaryNotes,
  SummarySection,
  SummaryStatCard,
  SummaryStatGrid,
} from '../components/WorkoutSummaryParts';
import { IndoorLapsTable } from '../components/IndoorLapsTable';
import { HROverTimeChart } from '../components/WorkoutCharts';
import { PremiumStatsCard } from '../components/PremiumStatsCard';
import { EffortScoreCard } from '../components/EffortScoreCard';
import {
  calorieProfile,
  computeEffortScore,
  estimateCalories,
  hasRecordedLaps,
  summarizeHR,
} from '../services/gpsUtils';
import { activeElapsedSec } from '../utils/workoutDuration';
import { buildIndoorRecordedData } from '../utils/indoorWorkout';
import { isPremium } from '../utils/premium';

/** Post-finish summary for an indoor run / ride recorded on RecordIndoorScreen. */
export default function IndoorWorkoutSummaryScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const maxHR = user?.max_heart_rate ?? 185;
  const { activeWorkout, clearWorkout } = useWorkout();
  const flow = useWorkoutSummarySave({ navigation, clearWorkout });
  const [notes, setNotes] = useState('');

  const workout = activeWorkout?.workoutType === 'cardio' ? activeWorkout : null;
  const hrReadings = useMemo(() => workout?.hrReadings ?? [], [workout?.hrReadings]);
  const durationSec = workout ? activeElapsedSec(workout, (workout.finishedAt ?? new Date()).getTime()) : 0;

  const { avg_hr: avgHR, max_hr: peakHR } = useMemo(() => summarizeHR(hrReadings), [hrReadings]);
  const effortData = useMemo(
    () => (hrReadings.length > 1 ? computeEffortScore(hrReadings, maxHR, durationSec) : null),
    [hrReadings, maxHR, durationSec],
  );

  if (!workout) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary, fontSize: 15 }}>No workout data available.</Text>
      </View>
    );
  }

  const calories = estimateCalories({
    activityType: workout.activityType,
    durationSec,
    avgHR,
    profile: calorieProfile(user),
  });
  // Only when the user pressed Lap (the final stretch is closed into the last lap).
  const laps = hasRecordedLaps(workout.laps) ? workout.laps : [];

  function handleSave() {
    if (!workout) return;
    void flow.save({
      activity_type: workout.activityType,
      recorded_data: buildIndoorRecordedData({ hrReadings, laps, calories }),
      heart_rate_data: hrReadings.length > 0
        ? { readings: hrReadings, device_name: workout.hrDeviceName }
        : undefined,
      source: 'manual',
      started_at: workout.startedAt.toISOString(),
      finished_at: workout.finishedAt?.toISOString(),
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
      <ScrollView
        style={[styles.flex, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 20 }]}
      >
        <SummaryHeader activityType={workout.activityType} startedAt={workout.startedAt} />

        <SummaryStatGrid>
          <SummaryStatCard label="Time" value={formatTime(Math.floor(durationSec))} />
          <SummaryStatCard label="Calories" value={`${calories}`} unit="kcal" />
          {avgHR != null && <SummaryStatCard label="Avg HR" value={`${avgHR}`} unit="bpm" />}
          {peakHR != null && <SummaryStatCard label="Max HR" value={`${peakHR}`} unit="bpm" />}
          {laps.length > 0 && <SummaryStatCard label="Laps" value={`${laps.length}`} />}
        </SummaryStatGrid>

        <HRZonesSection readings={hrReadings} maxHR={maxHR} />

        {hrReadings.length > 5 && <HROverTimeChart readings={hrReadings} maxHR={maxHR} />}

        {laps.length > 0 && (
          <SummarySection title="Lap Splits">
            <IndoorLapsTable laps={laps} maxHR={maxHR} />
          </SummarySection>
        )}

        {/* Pre-save effort preview — once saved, Grit's review panel shows the server analytics */}
        {effortData && !flow.savedWorkoutId && (
          <PremiumStatsCard isPremium={isPremium(user)} title="Analytics">
            <EffortScoreCard data={effortData} />
          </PremiumStatsCard>
        )}

        <SummaryNotes value={notes} onChange={setNotes} />

        <SummaryActions
          flow={flow}
          onSave={handleSave}
          activityType={workout.activityType}
          scheduledActivityId={workout.scheduledActivityId}
          hasSensorData={hrReadings.length > 0}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16 },
});
