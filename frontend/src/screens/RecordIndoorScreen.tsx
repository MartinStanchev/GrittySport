import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useWorkout, type ActiveWorkout, type GPSRecordingState } from '../contexts/WorkoutContext';
import { Fonts } from '../constants/fonts';
import { formatTime } from '../constants/workoutUtils';
import { formatActivityType } from '../constants/activityIcons';
import HRSensorModal from '../components/HRSensorModal';
import { HROverTimeChart } from '../components/WorkoutCharts';
import {
  HeroMetric,
  HRSensorRow,
  PrimaryActionButton,
  RecordingControls,
  SecondaryMetricCard,
  SessionBadge,
} from '../components/LiveWorkoutControls';
import { useHRAutoConnect } from '../hooks/useHRAutoConnect';
import { useWorkoutHRLog } from '../hooks/useWorkoutHRLog';
import { bleService } from '../services/bleService';
import { calorieProfile, estimateCalories, getHRZone, getHRZoneColor } from '../services/gpsUtils';
import { activeElapsedSec, closePause } from '../utils/workoutDuration';
import { buildIndoorLap, closeFinalIndoorLap } from '../utils/indoorWorkout';
import { getRecordingStatusLabel } from '../utils/liveWorkout';

type RecordIndoorParams = {
  scheduledActivityId?: string;
  activityType: string;
};

type Props = NativeStackScreenProps<any, 'RecordIndoor'>;

function recordingStateOf(workout: ActiveWorkout | null): GPSRecordingState {
  if (!workout) return 'idle';
  if (workout.phase === 'summary') return 'stopped';
  return workout.lastPauseStart != null ? 'paused' : 'recording';
}

/**
 * Live recording for indoor cardio (treadmill / stationary bike). Mirrors the GPS
 * recording screen — Start button, hold-to-activate Lap / Pause / Finish, the same hero
 * metrics — with the HR zone chart where the map would be. Finishing opens the indoor
 * summary, which saves and offers linking to a scheduled activity.
 */
export default function RecordIndoorScreen({ route, navigation }: Props) {
  const params = route.params as RecordIndoorParams | undefined;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const maxHR = user?.max_heart_rate ?? 185;
  const { activeWorkout, startWorkout, updateWorkout, clearWorkout, workoutMode } = useWorkout();

  // Another kind of manual workout (strength, mobility…) isn't ours to show.
  const workout = activeWorkout?.workoutType === 'cardio' ? activeWorkout : null;
  // Latest workout for HR callbacks, timers and alert handlers that outlive a render.
  const workoutRef = useRef(workout);
  useEffect(() => {
    workoutRef.current = workout;
  }, [workout]);
  const recordingState = recordingStateOf(workout);

  const activityType = params?.activityType ?? workout?.activityType ?? 'indoor_run';
  const scheduledActivityId = params?.scheduledActivityId ?? workout?.scheduledActivityId;

  const [elapsed, setElapsed] = useState(0);
  const [hrModalVisible, setHRModalVisible] = useState(false);
  const [previewHR, setPreviewHR] = useState<number | null>(null);
  const [previewDeviceName, setPreviewDeviceName] = useState<string | null>(null);

  useEffect(() => {
    if (workoutMode === 'gps') {
      Alert.alert(
        'GPS Workout In Progress',
        'You have a GPS workout in progress. Finish it before starting a new workout.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } else if (activeWorkout && activeWorkout.workoutType !== 'cardio') {
      Alert.alert(
        'Workout In Progress',
        'A workout is already active. Finish it before starting a new one.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } else if (
      workout &&
      params?.scheduledActivityId !== undefined &&
      params.scheduledActivityId !== workout.scheduledActivityId
    ) {
      Alert.alert(
        'Workout In Progress',
        'Finish your current workout before starting a new one.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-time guard

  // Active (unpaused) time from the shared helper — frozen while paused.
  const isLive = recordingState === 'recording' || recordingState === 'paused';
  useEffect(() => {
    if (!isLive) return;
    const tick = () => {
      const w = workoutRef.current;
      if (w) setElapsed(Math.floor(activeElapsedSec(w, Date.now())));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isLive, workout?.lastPauseStart]);

  const logHR = useWorkoutHRLog(workout, updateWorkout);
  const handleHRReading = useCallback((bpm: number) => {
    setPreviewHR(bpm);
    if (workoutRef.current?.phase === 'recording') logHR(bpm);
  }, [logHR]);

  const handleHRConnected = useCallback((deviceName: string) => {
    setPreviewDeviceName(deviceName);
    if (workoutRef.current) updateWorkout({ hrDeviceName: deviceName });
  }, [updateWorkout]);

  function handleHRModalClose() {
    setHRModalVisible(false);
    if (!bleService.isConnected()) {
      setPreviewHR(null);
      setPreviewDeviceName(null);
    }
  }

  const { connectingTo } = useHRAutoConnect({
    onReading: handleHRReading,
    onConnected: handleHRConnected,
    hasActiveWorkout: () => workoutRef.current !== null,
  });

  function handleStart() {
    startWorkout({
      workoutType: 'cardio',
      activityType,
      activityDisplayType: formatActivityType(activityType),
      scheduledActivityId,
      startedAt: new Date(),
    });
  }

  function handlePause() {
    const w = workoutRef.current;
    if (!w || w.lastPauseStart != null) return;
    updateWorkout({ lastPauseStart: Date.now() });
  }

  function handleResume() {
    const w = workoutRef.current;
    if (!w?.lastPauseStart) return;
    updateWorkout(closePause(w, Date.now()));
  }

  function handleLap() {
    const w = workoutRef.current;
    if (!w) return;
    const lap = buildIndoorLap(w, Date.now());
    if (!lap) return;
    updateWorkout({ laps: [...w.laps, lap] });
    showToast(`Lap ${lap.lap_number} · ${formatTime(Math.round(lap.duration_sec))}`);
  }

  function handleFinish() {
    Alert.alert('Finish Workout?', 'Are you sure you want to finish this workout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        style: 'destructive',
        onPress: () => {
          const w = workoutRef.current;
          if (!w) return;
          const now = Date.now();
          // Fold a pause still open at Finish into the total before closing the last lap.
          const resumed = closePause(w, now);
          updateWorkout({
            ...resumed,
            laps: closeFinalIndoorLap({ ...w, ...resumed }, now),
            phase: 'summary',
            finishedAt: new Date(now),
          });
          navigation.navigate('IndoorWorkoutSummary');
        },
      },
    ]);
  }

  function handleDiscard() {
    if (!workoutRef.current) {
      navigation.goBack();
      return;
    }
    Alert.alert('Discard Workout?', 'All recorded data will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          bleService.disconnect();
          clearWorkout();
          navigation.goBack();
        },
      },
    ]);
  }

  // The ticking value only while live; 0 before start, the final time once finished.
  let elapsedSec = 0;
  if (workout?.phase === 'summary' && workout.finishedAt) {
    elapsedSec = Math.floor(activeElapsedSec(workout, workout.finishedAt.getTime()));
  } else if (workout) {
    elapsedSec = elapsed;
  }
  const displayHR = workout?.currentHR ?? previewHR;
  const hrZoneColor = displayHR ? getHRZoneColor(displayHR, maxHR) : colors.textSecondary;
  const primaryTone = recordingState === 'recording' ? colors.secondary : colors.primary;
  const statusLabel = getRecordingStatusLabel(recordingState, false);
  const calories = workout
    ? estimateCalories({ activityType, durationSec: elapsedSec, avgHR: workout.avgHR, profile: calorieProfile(user) })
    : 0;
  const laps = workout?.laps ?? [];
  const lastLap = laps[laps.length - 1];
  const currentLapSec = Math.max(0, elapsedSec - laps.reduce((s, lap) => s + lap.duration_sec, 0));
  const hrReadings = workout?.hrReadings ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Pressable style={[styles.iconButton, { backgroundColor: colors.surface }]} onPress={handleDiscard}>
          <Ionicons name="close" size={20} color={colors.textPrimary} />
        </Pressable>
        <SessionBadge
          title={formatActivityType(activityType)}
          status={statusLabel}
          tone={primaryTone}
          backgroundColor={colors.surface}
        />
        <Pressable
          style={[styles.hrBadge, { backgroundColor: colors.surface }]}
          onPress={() => setHRModalVisible(true)}
        >
          <Ionicons name={displayHR ? 'heart' : 'heart-outline'} size={14} color={hrZoneColor} />
          <Text style={[styles.hrBadgeText, { color: colors.textPrimary }]}>
            {displayHR ? `${displayHR} bpm` : 'No HR'}
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {hrReadings.length >= 2 ? (
          <HROverTimeChart readings={hrReadings} maxHR={maxHR} />
        ) : (
          <HRChartPlaceholder
            connected={displayHR != null}
            recording={workout != null}
            onConnect={() => setHRModalVisible(true)}
          />
        )}

        <View style={styles.metricGrid}>
          <SecondaryMetricCard
            label="Avg HR"
            value={workout?.avgHR ? String(workout.avgHR) : '—'}
            unit={workout?.avgHR ? 'bpm' : undefined}
            accent={hrZoneColor}
            support={workout?.avgHR ? 'Session average' : 'Sensor optional'}
          />
          <SecondaryMetricCard
            label="Zone"
            value={displayHR ? `Z${getHRZone(displayHR, maxHR)}` : '—'}
            accent={hrZoneColor}
            support={displayHR ? `${Math.round((displayHR / maxHR) * 100)}% of max HR` : 'Needs a sensor'}
          />
          <SecondaryMetricCard
            label="Lap"
            value={String(laps.length + 1)}
            accent={colors.tertiary}
            support={workout ? `Lap time ${formatTime(Math.floor(currentLapSec))}` : 'Hold Lap to split'}
          />
          <SecondaryMetricCard
            label="Last Lap"
            value={lastLap ? formatTime(Math.round(lastLap.duration_sec)) : '—'}
            accent={colors.primary}
            support={lastLap?.avg_hr ? `Avg ${lastLap.avg_hr} bpm` : lastLap ? 'No HR data' : 'No laps yet'}
          />
        </View>

        <HRSensorRow
          deviceName={workout?.hrDeviceName ?? previewDeviceName}
          connectingTo={connectingTo}
          zoneColor={hrZoneColor}
          onPress={() => setHRModalVisible(true)}
        />
      </ScrollView>

      <View style={[styles.dock, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.heroCard, { backgroundColor: colors.surfaceAlt }]}>
          <HeroMetric label="Time" value={formatTime(elapsedSec)} accent={primaryTone} emphasized />
          <HeroMetric
            label="HR"
            value={displayHR ? String(displayHR) : '—'}
            unit={displayHR ? 'bpm' : undefined}
            accent={hrZoneColor}
          />
          <HeroMetric label="Calories" value={String(calories)} unit="kcal" accent={colors.tertiary} />
        </View>

        <View style={styles.controlsDock}>
          {recordingState === 'idle' && (
            <PrimaryActionButton icon="play" label="Start Workout" onPress={handleStart} />
          )}
          {(recordingState === 'recording' || recordingState === 'paused') && (
            <RecordingControls
              paused={recordingState === 'paused'}
              onLap={handleLap}
              onPause={handlePause}
              onResume={handleResume}
              onFinish={handleFinish}
              onDiscard={handleDiscard}
            />
          )}
          {recordingState === 'stopped' && (
            <PrimaryActionButton
              icon="stats-chart"
              label="View Summary"
              onPress={() => navigation.navigate('IndoorWorkoutSummary')}
            />
          )}
        </View>
      </View>

      <HRSensorModal
        visible={hrModalVisible}
        onClose={handleHRModalClose}
        onConnected={handleHRConnected}
        onReading={handleHRReading}
      />
    </View>
  );
}

function HRChartPlaceholder({
  connected,
  recording,
  onConnect,
}: {
  connected: boolean;
  recording: boolean;
  onConnect: () => void;
}) {
  const { colors } = useTheme();
  let message = 'Connect a heart rate monitor to see your time in each zone.';
  if (connected) {
    message = recording
      ? 'Collecting heart rate…'
      : 'Heart rate monitor connected. Your zone chart starts when you press Start.';
  }
  return (
    <View style={[styles.placeholder, { backgroundColor: colors.surface }]}>
      <Ionicons name="pulse" size={28} color={colors.textSecondary} />
      <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>{message}</Text>
      {!connected && (
        <Pressable style={[styles.placeholderButton, { borderColor: colors.primary }]} onPress={onConnect}>
          <Text style={[styles.placeholderButtonText, { color: colors.primary }]}>Connect sensor</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hrBadge: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hrBadgeText: { fontSize: 12, fontFamily: Fonts.bodySemiBold, fontVariant: ['tabular-nums'] },
  scrollContent: { padding: 16, paddingBottom: 24 },
  placeholder: {
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  placeholderText: { fontSize: 13, fontFamily: Fonts.body, textAlign: 'center' },
  placeholderButton: { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  placeholderButtonText: { fontSize: 13, fontFamily: Fonts.bodySemiBold },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dock: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  heroCard: {
    borderRadius: 28,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 14,
  },
  controlsDock: { marginTop: 14 },
});
