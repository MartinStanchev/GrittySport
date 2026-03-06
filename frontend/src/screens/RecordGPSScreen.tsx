import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Polyline, UrlTile } from '../components/NativeMap';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../constants/colors';
import { formatTime } from '../constants/workoutUtils';
import { useWorkout } from '../contexts/WorkoutContext';
import { useAuth } from '../contexts/AuthContext';
import type { ActiveGPSWorkout } from '../contexts/WorkoutContext';
import {
  haversineMetres,
  rollingPaceSecPerKm,
  currentSpeedKph,
  avgPaceSecPerKm,
  avgSpeedKph,
  computeElevationGain,
  triggerLap,
  formatPaceSecPerKm,
  formatSpeedKph,
  formatDistanceKm,
  isRunSport,
  getHRZoneColor,
} from '../services/gpsUtils';
import { bleService } from '../services/bleService';
import { cadenceService } from '../services/cadenceService';
import HRSensorModal from '../components/HRSensorModal';
import type { GPSPoint, CadenceReading } from '../types/gps';

export type RecordGPSParams = {
  scheduledActivityId?: string;
  activityType: string;
};

type Props = NativeStackScreenProps<any, 'RecordGPS'>;

const MAX_ACCURACY_METRES = 50;
const AUTO_PAUSE_SPEED_THRESHOLD = 0.5; // m/s
const AUTO_PAUSE_POINT_COUNT = 3;
const AUTO_LAP_DISTANCE_M = 1000;

export default function RecordGPSScreen({ route, navigation }: Props) {
  const params = route.params as RecordGPSParams | undefined;
  const insets = useSafeAreaInsets();
  const { activeGPSWorkout, startGPSWorkout, updateGPSWorkout, clearGPSWorkout, workoutMode } = useWorkout();
  const { user } = useAuth();
  const maxHR = user?.max_heart_rate ?? 185;

  // Derive from route params (fresh navigation) or from existing context (returning via banner)
  const activityType = params?.activityType ?? activeGPSWorkout?.activityType ?? '';
  const scheduledActivityId = params?.scheduledActivityId ?? activeGPSWorkout?.scheduledActivityId;
  const isRun = isRunSport(activityType);

  const mapRef = useRef<any>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const slowPointCountRef = useRef(0);
  const hrReadingsRef = useRef<{ bpm: number; timestamp: number }[]>([]);
  const cadenceReadingsRef = useRef<CadenceReading[]>([]);
  const showCadence = isRun || activityType === 'walk';
  // Ref so location-watcher callback always reads latest state without being recreated
  const gpsWorkoutRef = useRef<ActiveGPSWorkout | null>(null);
  gpsWorkoutRef.current = activeGPSWorkout;
  // Map pan tracking for 5-second re-center delay
  const userMovedMapRef = useRef(false);
  const followTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [hrModalVisible, setHRModalVisible] = useState(false);
  const [userMovedMap, setUserMovedMap] = useState(false);

  const workout = activeGPSWorkout;
  const recordingState = workout?.recordingState ?? 'idle';

  // Guard against wrong state on mount, and clean up location watcher on unmount
  useEffect(() => {
    if (workoutMode === 'manual') {
      Alert.alert(
        'Workout In Progress',
        'A manual workout is already active. Finish it before starting a GPS session.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      return;
    }
    // Fix 2: block navigation to a different GPS activity while one is already recording
    if (activeGPSWorkout !== null) {
      const p = params;
      const isDifferent =
        p?.scheduledActivityId !== undefined &&
        p.scheduledActivityId !== activeGPSWorkout.scheduledActivityId;
      if (isDifferent) {
        Alert.alert(
          'GPS Session Active',
          'Finish your current GPS activity before starting a new one.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
      // Otherwise: banner navigation back to same session — just show live UI
      return;
    }
    // Fix 4: pre-start mode — do NOT call startGPSWorkout here.
    // The user must press the Start button, which calls startGPSWorkout + startLocationWatcher.
    return () => {
      locationSubRef.current?.remove();
      locationSubRef.current = null;
      cadenceService.stop();
      if (followTimerRef.current) clearTimeout(followTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pan map to current location on mount (no prompt if permission not yet granted)
  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      mapRef.current?.animateToRegion(
        { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        300
      );
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Elapsed timer (driven from startedAt minus accumulated paused time)
  useEffect(() => {
    if (!workout || recordingState !== 'recording') return;
    const interval = setInterval(() => {
      const rawElapsed = (Date.now() - workout.startedAt.getTime()) / 1000;
      setElapsed(Math.floor(rawElapsed - workout.autoPausedDurationSec));
    }, 1000);
    return () => clearInterval(interval);
  }, [workout?.startedAt, workout?.autoPausedDurationSec, recordingState]);

  const handleAutoPause = useCallback((timestamp: number) => {
    updateGPSWorkout({ recordingState: 'paused', lastAutoPauseStart: timestamp });
    slowPointCountRef.current = 0;
  }, [updateGPSWorkout]);

  const handleNewPoint = useCallback(
    (location: Location.LocationObject) => {
      const gpsWorkout = gpsWorkoutRef.current;
      if (!gpsWorkout || gpsWorkout.recordingState !== 'recording') return;

      const { latitude, longitude, altitude, accuracy } = location.coords;

      // Filter inaccurate points
      if (accuracy && accuracy > MAX_ACCURACY_METRES) return;

      const newPoint: GPSPoint = {
        lat: latitude,
        lng: longitude,
        altitude: altitude ?? null,
        accuracy: accuracy ?? 0,
        speed: location.coords.speed ?? null,
        timestamp: location.timestamp,
        distance_from_prev: 0,
      };

      const points = gpsWorkout.points;
      if (points.length > 0) {
        newPoint.distance_from_prev = haversineMetres(points[points.length - 1], newPoint);
      }

      const allPoints = [...points, newPoint];
      const newDistanceM = gpsWorkout.totalDistanceM + newPoint.distance_from_prev;

      // Auto-pause check — use haversine-computed speed, not GPS chip speed.
      // GPS chip returns -1 on iOS when speed is unknown, which would always
      // trigger auto-pause. Computing from consecutive points is more reliable.
      const prevPoint = points.length > 0 ? points[points.length - 1] : null;
      const timeDeltaSec = prevPoint ? (newPoint.timestamp - prevPoint.timestamp) / 1000 : 0;
      const computedSpeedMs =
        prevPoint && timeDeltaSec > 0.5
          ? haversineMetres(prevPoint, newPoint) / timeDeltaSec
          : null; // insufficient data — don't auto-pause yet

      if (computedSpeedMs !== null && computedSpeedMs < AUTO_PAUSE_SPEED_THRESHOLD) {
        slowPointCountRef.current += 1;
        if (slowPointCountRef.current >= AUTO_PAUSE_POINT_COUNT) {
          handleAutoPause(newPoint.timestamp);
          return;
        }
      } else {
        slowPointCountRef.current = 0;
      }

      // Auto-lap check
      const distanceSinceLastLap = newDistanceM - gpsWorkout.lapStartDistanceM;
      let newLaps = gpsWorkout.laps;
      let newLapStartIndex = gpsWorkout.lapStartIndex;
      let newLapStartDistanceM = gpsWorkout.lapStartDistanceM;

      if (distanceSinceLastLap >= AUTO_LAP_DISTANCE_M) {
        const lap = triggerLap(allPoints, newLapStartIndex, newLaps, gpsWorkout.hrReadings);
        newLaps = [...newLaps, lap];
        newLapStartIndex = allPoints.length - 1;
        newLapStartDistanceM = newDistanceM;
      }

      // Computed metrics
      const pace = rollingPaceSecPerKm(allPoints);
      const spd = currentSpeedKph(allPoints);
      const totalSec = (newPoint.timestamp - gpsWorkout.startedAt.getTime()) / 1000 - gpsWorkout.autoPausedDurationSec;
      const avgPace = avgPaceSecPerKm(newDistanceM, totalSec);
      const avgSpd = avgSpeedKph(newDistanceM, totalSec);
      // Compute elevation every 10 points to avoid excessive work
      const elevGain =
        allPoints.length % 10 === 0
          ? computeElevationGain(allPoints)
          : gpsWorkout.elevationGainM;

      updateGPSWorkout({
        points: allPoints,
        totalDistanceM: newDistanceM,
        currentPaceSecPerKm: pace,
        avgPaceSecPerKm: avgPace,
        currentSpeedKph: spd,
        avgSpeedKph: avgSpd,
        elevationGainM: elevGain,
        laps: newLaps,
        lapStartIndex: newLapStartIndex,
        lapStartDistanceM: newLapStartDistanceM,
      });

      // Pan map to follow user (respect 5-second cooldown after manual pan)
      if (!userMovedMapRef.current) {
        mapRef.current?.animateToRegion(
          { latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 },
          300
        );
      }
    },
    [updateGPSWorkout, handleAutoPause]
  );

  // Fix 3: 5-second map re-center delay after user pans
  const handleMapPanDrag = useCallback(() => {
    userMovedMapRef.current = true;
    setUserMovedMap(true);
    if (followTimerRef.current) clearTimeout(followTimerRef.current);
    followTimerRef.current = setTimeout(() => {
      userMovedMapRef.current = false;
      setUserMovedMap(false);
    }, 5000);
  }, []);

  const startLocationWatcher = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Location access is needed to track your workout.');
      return;
    }
    locationSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 5,
        timeInterval: 1000,
      },
      handleNewPoint
    );
  }, [handleNewPoint]);

  const handleStart = useCallback(async () => {
    // Fix 4: create the GPS workout context only when the user explicitly starts
    const displayType = activityType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    startGPSWorkout({ activityType, activityDisplayType: displayType, scheduledActivityId, startedAt: new Date() });
    // React 18 batches this with startGPSWorkout — functional updater sees the freshly initialised workout
    updateGPSWorkout({ recordingState: 'recording' });
    await startLocationWatcher();
    // Start cadence tracking for run/walk activities
    if (showCadence) {
      cadenceService.start((spm) => {
        const now = Date.now();
        cadenceReadingsRef.current = [...cadenceReadingsRef.current, { spm, timestamp: now }];
        const avg = Math.round(
          cadenceReadingsRef.current.reduce((s, r) => s + r.spm, 0) / cadenceReadingsRef.current.length,
        );
        updateGPSWorkout({ cadenceReadings: cadenceReadingsRef.current, currentCadence: spm, avgCadence: avg });
      });
    }
  }, [startGPSWorkout, updateGPSWorkout, startLocationWatcher, activityType, scheduledActivityId, showCadence]);

  const handlePause = useCallback(() => {
    updateGPSWorkout({ recordingState: 'paused', lastAutoPauseStart: Date.now() });
  }, [updateGPSWorkout]);

  const handleResume = useCallback(() => {
    const gpsWorkout = gpsWorkoutRef.current;
    if (!gpsWorkout) return;
    const pausedSince = gpsWorkout.lastAutoPauseStart ?? Date.now();
    const additionalPause = (Date.now() - pausedSince) / 1000;
    updateGPSWorkout({
      recordingState: 'recording',
      autoPausedDurationSec: gpsWorkout.autoPausedDurationSec + additionalPause,
      lastAutoPauseStart: null,
    });
    slowPointCountRef.current = 0;
  }, [updateGPSWorkout]);

  const handleStop = useCallback(() => {
    Alert.alert('Stop Workout?', 'Are you sure you want to finish this workout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop',
        style: 'destructive',
        onPress: () => {
          locationSubRef.current?.remove();
          locationSubRef.current = null;
          cadenceService.stop();
          const now = new Date();
          let autoPaused = gpsWorkoutRef.current?.autoPausedDurationSec ?? 0;
          if (gpsWorkoutRef.current?.lastAutoPauseStart) {
            autoPaused += (Date.now() - gpsWorkoutRef.current.lastAutoPauseStart) / 1000;
          }
          updateGPSWorkout({ recordingState: 'stopped', finishedAt: now, autoPausedDurationSec: autoPaused });
          navigation.navigate('WorkoutSummary');
        },
      },
    ]);
  }, [updateGPSWorkout, navigation]);

  const handleManualLap = useCallback(() => {
    const gpsWorkout = gpsWorkoutRef.current;
    if (!gpsWorkout || gpsWorkout.points.length === 0) return;
    const lap = triggerLap(
      gpsWorkout.points,
      gpsWorkout.lapStartIndex,
      gpsWorkout.laps,
      gpsWorkout.hrReadings
    );
    updateGPSWorkout({
      laps: [...gpsWorkout.laps, lap],
      lapStartIndex: gpsWorkout.points.length - 1,
      lapStartDistanceM: gpsWorkout.totalDistanceM,
    });
  }, [updateGPSWorkout]);

  const handleDiscard = useCallback(() => {
    // Fix 4: pre-start mode — no workout recorded yet, just go back
    if (!gpsWorkoutRef.current) {
      navigation.goBack();
      return;
    }
    Alert.alert('Discard Workout?', 'All recorded data will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          locationSubRef.current?.remove();
          locationSubRef.current = null;
          bleService.disconnect();
          cadenceService.stop();
          clearGPSWorkout();
          navigation.goBack();
        },
      },
    ]);
  }, [clearGPSWorkout, navigation]);

  const handleHRReading = useCallback((bpm: number) => {
    const now = Date.now();
    hrReadingsRef.current = [...hrReadingsRef.current, { bpm, timestamp: now }];
    const avg = Math.round(
      hrReadingsRef.current.reduce((s, r) => s + r.bpm, 0) / hrReadingsRef.current.length,
    );
    updateGPSWorkout({ hrReadings: hrReadingsRef.current, currentHR: bpm, avgHR: avg });
  }, [updateGPSWorkout]);

  const handleHRConnected = useCallback((deviceName: string) => {
    updateGPSWorkout({ hrDeviceName: deviceName });
  }, [updateGPSWorkout]);

  const polylineCoords = useMemo(
    () => (workout?.points ?? []).map((p) => ({ latitude: p.lat, longitude: p.lng })),
    [workout?.points],
  );

  const currentPosition =
    workout && workout.points.length > 0
      ? { latitude: workout.points[workout.points.length - 1].lat, longitude: workout.points[workout.points.length - 1].lng }
      : null;

  const hrZoneColor = workout?.currentHR
    ? getHRZoneColor(workout.currentHR, maxHR)
    : Colors.textSecondary;

  // Re-center map on user
  const handleRecenter = useCallback(() => {
    const gpsWorkout = gpsWorkoutRef.current;
    if (gpsWorkout && gpsWorkout.points.length > 0) {
      const last = gpsWorkout.points[gpsWorkout.points.length - 1];
      mapRef.current?.animateToRegion(
        { latitude: last.lat, longitude: last.lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
        300,
      );
    }
    userMovedMapRef.current = false;
    setUserMovedMap(false);
    if (followTimerRef.current) clearTimeout(followTimerRef.current);
  }, []);

  // Build compact metric items for horizontal scroll
  const metricItems: { label: string; value: string; unit?: string; color?: string }[] = [
    { label: 'Distance', value: formatDistanceKm(workout?.totalDistanceM ?? 0), unit: 'km' },
    { label: 'Time', value: formatTime(elapsed) },
    {
      label: isRun ? 'Pace' : 'Speed',
      value: isRun
        ? formatPaceSecPerKm(workout?.currentPaceSecPerKm ?? 0)
        : formatSpeedKph(workout?.currentSpeedKph ?? 0),
      unit: isRun ? '/km' : 'km/h',
    },
    {
      label: 'HR',
      value: workout?.currentHR ? `${workout.currentHR}` : '—',
      unit: workout?.currentHR ? 'bpm' : undefined,
      color: hrZoneColor,
    },
    {
      label: isRun ? 'Avg Pace' : 'Avg Spd',
      value: isRun
        ? formatPaceSecPerKm(workout?.avgPaceSecPerKm ?? 0)
        : formatSpeedKph(workout?.avgSpeedKph ?? 0),
      unit: isRun ? '/km' : 'km/h',
    },
    {
      label: 'Avg HR',
      value: workout?.avgHR ? `${workout.avgHR}` : '—',
      unit: workout?.avgHR ? 'bpm' : undefined,
    },
    { label: 'Elev +', value: `${workout?.elevationGainM ?? 0}`, unit: 'm' },
    ...(showCadence
      ? [
          { label: 'Cadence', value: workout?.currentCadence ? `${workout.currentCadence}` : '—', unit: 'spm' },
          { label: 'Avg Cad', value: workout?.avgCadence ? `${workout.avgCadence}` : '—', unit: 'spm' },
        ]
      : []),
    { label: 'Lap', value: `${(workout?.laps.length ?? 0) + 1}` },
  ];

  return (
    <View style={styles.container}>
      {/* Map section — takes ~75% of screen */}
      <View style={styles.mapSection}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          mapType={Platform.OS === 'android' ? 'none' : 'standard'}
          showsUserLocation
          followsUserLocation={false}
          onPanDrag={handleMapPanDrag}
          initialRegion={
            currentPosition
              ? { ...currentPosition, latitudeDelta: 0.01, longitudeDelta: 0.01 }
              : { latitude: 0, longitude: 0, latitudeDelta: 90, longitudeDelta: 90 }
          }
        >
          {Platform.OS === 'android' && (
            <UrlTile
              urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maximumZ={19}
              flipY={false}
            />
          )}
          {polylineCoords.length > 1 && (
            <Polyline
              coordinates={polylineCoords}
              strokeColor={Colors.primary}
              strokeWidth={4}
            />
          )}
        </MapView>

        {/* Floating close button */}
        <Pressable style={[styles.mapCloseBtn, { top: insets.top + 12 }]} onPress={handleDiscard}>
          <Ionicons name="close" size={20} color="#FFF" />
        </Pressable>

        {/* Re-center button */}
        {userMovedMap && recordingState === 'recording' && (
          <Pressable style={styles.recenterBtn} onPress={handleRecenter}>
            <Ionicons name="navigate" size={20} color={Colors.primary} />
          </Pressable>
        )}

        {/* Auto-pause indicator */}
        {recordingState === 'paused' && workout && workout.points.length > 0 && (
          <View style={styles.autoPauseBanner}>
            <Ionicons name="pause-circle" size={16} color="#FFF" />
            <Text style={styles.autoPauseText}>Auto-paused</Text>
          </View>
        )}
      </View>

      {/* Compact bottom panel */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 8 }]}>
        {/* Horizontally scrollable metrics */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.metricsScroll}
        >
          {metricItems.map((item, i) => (
            <View key={item.label} style={[styles.compactMetric, i === 0 && { marginLeft: 0 }]}>
              <Text style={styles.compactLabel}>{item.label}</Text>
              <View style={styles.compactValueRow}>
                <Text style={[styles.compactValue, item.color ? { color: item.color } : undefined]}>
                  {item.value}
                </Text>
                {item.unit && <Text style={styles.compactUnit}>{item.unit}</Text>}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Control buttons */}
        <View style={styles.controls}>
          {recordingState === 'idle' && (
            <Pressable style={[styles.bigBtn, styles.startBtn]} onPress={handleStart}>
              <Text style={styles.bigBtnText}>Start</Text>
            </Pressable>
          )}
          {recordingState === 'recording' && (
            <>
              <Pressable style={styles.controlBtn} onPress={handleManualLap}>
                <Ionicons name="flag-outline" size={20} color={Colors.primary} />
                <Text style={styles.controlBtnLabel}>Lap</Text>
              </Pressable>
              <Pressable style={[styles.bigBtn, styles.pauseBtn]} onPress={handlePause}>
                <Ionicons name="pause" size={24} color="#FFF" />
              </Pressable>
              <Pressable style={styles.controlBtn} onPress={handleStop}>
                <Ionicons name="stop" size={20} color={Colors.primary} />
                <Text style={styles.controlBtnLabel}>Stop</Text>
              </Pressable>
            </>
          )}
          {recordingState === 'paused' && (
            <>
              <Pressable style={styles.controlBtn} onPress={handleStop}>
                <Ionicons name="stop" size={20} color={Colors.primary} />
                <Text style={styles.controlBtnLabel}>Stop</Text>
              </Pressable>
              <Pressable style={[styles.bigBtn, styles.resumeBtn]} onPress={handleResume}>
                <Ionicons name="play" size={24} color="#FFF" />
              </Pressable>
              <View style={styles.controlBtn} />
            </>
          )}
        </View>

        {/* HR device row */}
        <Pressable style={styles.hrRow} onPress={() => setHRModalVisible(true)}>
          <Ionicons
            name={bleService.isConnected() ? 'heart' : 'heart-outline'}
            size={14}
            color={bleService.isConnected() ? Colors.primary : Colors.textSecondary}
          />
          <Text style={styles.hrRowText}>
            {bleService.isConnected()
              ? `Connected: ${bleService.getDeviceName()}`
              : 'Connect HR Monitor'}
          </Text>
        </Pressable>
      </View>

      <HRSensorModal
        visible={hrModalVisible}
        onClose={() => setHRModalVisible(false)}
        onConnected={handleHRConnected}
        onReading={handleHRReading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  mapSection: { flex: 3, position: 'relative' },
  mapCloseBtn: {
    position: 'absolute',
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  recenterBtn: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#FFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  autoPauseBanner: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  autoPauseText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  bottomPanel: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
    marginTop: -16,
  },
  metricsScroll: { paddingHorizontal: 12, gap: 8 },
  compactMetric: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 72,
  },
  compactLabel: { fontSize: 10, color: Colors.textSecondary, marginBottom: 1 },
  compactValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  compactValue: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, fontVariant: ['tabular-nums'] },
  compactUnit: { fontSize: 10, color: Colors.textSecondary },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  bigBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtn: { backgroundColor: '#4CAF50', width: 110, height: 48, borderRadius: 24 },
  pauseBtn: { backgroundColor: Colors.primary },
  resumeBtn: { backgroundColor: '#4CAF50' },
  bigBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  controlBtn: { width: 48, alignItems: 'center', gap: 2 },
  controlBtnLabel: { fontSize: 10, color: Colors.textSecondary },
  hrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 2,
  },
  hrRowText: { fontSize: 11, color: Colors.textSecondary },
});
