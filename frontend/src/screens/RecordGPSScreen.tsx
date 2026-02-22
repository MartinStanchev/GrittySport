import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
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
} from '../services/gpsUtils';
import { bleService } from '../services/bleService';
import type { GPSPoint } from '../types/gps';

export type RecordGPSParams = {
  scheduledActivityId?: string;
  activityType: string;
};

type Props = NativeStackScreenProps<any, 'RecordGPS'>;

const MAX_ACCURACY_METRES = 50;
const AUTO_PAUSE_SPEED_THRESHOLD = 0.5; // m/s
const AUTO_PAUSE_POINT_COUNT = 3;
const AUTO_LAP_DISTANCE_M = 1000;

interface BLEDevice {
  id: string;
  name: string;
}

export default function RecordGPSScreen({ route, navigation }: Props) {
  const params = route.params as RecordGPSParams | undefined;
  const insets = useSafeAreaInsets();
  const { activeGPSWorkout, startGPSWorkout, updateGPSWorkout, clearGPSWorkout, workoutMode } = useWorkout();

  // Derive from route params (fresh navigation) or from existing context (returning via banner)
  const activityType = params?.activityType ?? activeGPSWorkout?.activityType ?? '';
  const scheduledActivityId = params?.scheduledActivityId ?? activeGPSWorkout?.scheduledActivityId;
  const isRun = isRunSport(activityType);

  const mapRef = useRef<any>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const slowPointCountRef = useRef(0);
  const hrReadingsRef = useRef<{ bpm: number; timestamp: number }[]>([]);
  // Ref so location-watcher callback always reads latest state without being recreated
  const gpsWorkoutRef = useRef<ActiveGPSWorkout | null>(null);
  gpsWorkoutRef.current = activeGPSWorkout;
  // Map pan tracking for 5-second re-center delay
  const userMovedMapRef = useRef(false);
  const followTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [hrModalVisible, setHRModalVisible] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<BLEDevice[]>([]);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);

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
    [updateGPSWorkout]
  );

  // Fix 3: 5-second map re-center delay after user pans
  const handleMapPanDrag = useCallback(() => {
    userMovedMapRef.current = true;
    if (followTimerRef.current) clearTimeout(followTimerRef.current);
    followTimerRef.current = setTimeout(() => {
      userMovedMapRef.current = false;
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
  }, [startGPSWorkout, updateGPSWorkout, startLocationWatcher, activityType, scheduledActivityId]);

  const handlePause = useCallback(() => {
    updateGPSWorkout({ recordingState: 'paused', lastAutoPauseStart: Date.now() });
  }, [updateGPSWorkout]);

  const handleAutoPause = useCallback((timestamp: number) => {
    updateGPSWorkout({ recordingState: 'paused', lastAutoPauseStart: timestamp });
    slowPointCountRef.current = 0;
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
          clearGPSWorkout();
          navigation.goBack();
        },
      },
    ]);
  }, [clearGPSWorkout, navigation]);

  // BLE scanning
  const handleOpenHRModal = useCallback(async () => {
    if (!bleService.available) {
      Alert.alert(
        'HR Monitor Unavailable',
        'Heart rate monitor connectivity requires a native dev build (not Expo Go).'
      );
      return;
    }
    setDiscoveredDevices([]);
    setHRModalVisible(true);
    await bleService.scan((id, name) => {
      setDiscoveredDevices((prev) => {
        if (prev.find((d) => d.id === id)) return prev;
        return [...prev, { id, name }];
      });
    }, 10000);
  }, []);

  const handleConnectDevice = useCallback(async (deviceId: string) => {
    setConnectingDeviceId(deviceId);
    try {
      await bleService.connect(deviceId, (bpm) => {
        const now = Date.now();
        hrReadingsRef.current = [...hrReadingsRef.current, { bpm, timestamp: now }];
        const avg = Math.round(
          hrReadingsRef.current.reduce((s, r) => s + r.bpm, 0) / hrReadingsRef.current.length
        );
        updateGPSWorkout({ hrReadings: hrReadingsRef.current, currentHR: bpm, avgHR: avg });
      });
      setHRModalVisible(false);
      updateGPSWorkout({ hrDeviceName: bleService.getDeviceName() ?? undefined });
    } catch {
      Alert.alert('Connection Failed', 'Could not connect to the heart rate monitor.');
    } finally {
      setConnectingDeviceId(null);
    }
  }, [updateGPSWorkout]);

  const polylineCoords = (workout?.points ?? []).map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
  }));

  const currentPosition =
    workout && workout.points.length > 0
      ? { latitude: workout.points[workout.points.length - 1].lat, longitude: workout.points[workout.points.length - 1].lng }
      : null;

  const hrZoneColor = workout?.currentHR
    ? getHRZoneColor(workout.currentHR)
    : Colors.textSecondary;

  return (
    <View style={styles.container}>
      {/* Map */}
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

      {/* Auto-pause indicator */}
      {recordingState === 'paused' && workout && workout.points.length > 0 && (
        <View style={styles.autoPauseBanner}>
          <Ionicons name="pause-circle" size={16} color="#FFF" />
          <Text style={styles.autoPauseText}>Auto-paused</Text>
        </View>
      )}

      {/* Metrics panel */}
      <View style={[styles.metricsPanel, { paddingBottom: insets.bottom + 12 }]}>
        {/* Distance — hero metric */}
        <View style={styles.heroRow}>
          <Text style={styles.heroValue}>{formatDistanceKm(workout?.totalDistanceM ?? 0)}</Text>
          <Text style={styles.heroUnit}>km</Text>
        </View>

        {/* Row 1: pace/speed, time, HR */}
        <View style={styles.metricRow}>
          <MetricCell
            label={isRun ? 'Pace' : 'Speed'}
            value={isRun ? formatPaceSecPerKm(workout?.currentPaceSecPerKm ?? 0) : `${formatSpeedKph(workout?.currentSpeedKph ?? 0)}`}
            unit={isRun ? '/km' : 'km/h'}
          />
          <View style={styles.metricDivider} />
          <MetricCell label="Time" value={formatTime(elapsed)} />
          <View style={styles.metricDivider} />
          <MetricCell
            label="HR"
            value={workout?.currentHR ? `${workout.currentHR}` : '—'}
            unit={workout?.currentHR ? 'bpm' : undefined}
            valueStyle={{ color: hrZoneColor }}
          />
        </View>

        {/* Row 2: avg pace/speed, elevation, lap */}
        <View style={styles.metricRow}>
          <MetricCell
            label={isRun ? 'Avg Pace' : 'Avg Speed'}
            value={isRun ? formatPaceSecPerKm(workout?.avgPaceSecPerKm ?? 0) : `${formatSpeedKph(workout?.avgSpeedKph ?? 0)}`}
            unit={isRun ? '/km' : 'km/h'}
          />
          <View style={styles.metricDivider} />
          <MetricCell
            label="Elev +"
            value={`${workout?.elevationGainM ?? 0}`}
            unit="m"
          />
          <View style={styles.metricDivider} />
          <MetricCell
            label="Lap"
            value={`${(workout?.laps.length ?? 0) + 1}`}
          />
        </View>

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
                <Ionicons name="flag-outline" size={22} color={Colors.primary} />
                <Text style={styles.controlBtnLabel}>Lap</Text>
              </Pressable>
              <Pressable style={[styles.bigBtn, styles.pauseBtn]} onPress={handlePause}>
                <Ionicons name="pause" size={28} color="#FFF" />
              </Pressable>
              <Pressable style={styles.controlBtn} onPress={handleStop}>
                <Ionicons name="stop" size={22} color={Colors.primary} />
                <Text style={styles.controlBtnLabel}>Stop</Text>
              </Pressable>
            </>
          )}
          {recordingState === 'paused' && (
            <>
              <Pressable style={styles.controlBtn} onPress={handleStop}>
                <Ionicons name="stop" size={22} color={Colors.primary} />
                <Text style={styles.controlBtnLabel}>Stop</Text>
              </Pressable>
              <Pressable style={[styles.bigBtn, styles.resumeBtn]} onPress={handleResume}>
                <Ionicons name="play" size={28} color="#FFF" />
              </Pressable>
              <View style={styles.controlBtn} />
            </>
          )}
        </View>

        {/* HR device row */}
        <Pressable style={styles.hrRow} onPress={handleOpenHRModal}>
          <Ionicons
            name={bleService.isConnected() ? 'heart' : 'heart-outline'}
            size={16}
            color={bleService.isConnected() ? Colors.primary : Colors.textSecondary}
          />
          <Text style={styles.hrRowText}>
            {bleService.isConnected()
              ? `Connected: ${bleService.getDeviceName()}`
              : 'Connect HR Monitor'}
          </Text>
        </Pressable>
      </View>

      {/* BLE device modal */}
      <Modal visible={hrModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Heart Rate Monitors</Text>
            <Text style={styles.modalSubtitle}>Scanning for nearby devices...</Text>
            {discoveredDevices.length === 0 ? (
              <View style={styles.noDevices}>
                <Ionicons name="bluetooth-outline" size={40} color={Colors.textSecondary} />
                <Text style={styles.noDevicesText}>No devices found yet</Text>
              </View>
            ) : (
              <ScrollView style={styles.deviceList}>
                {discoveredDevices.map((device) => (
                  <Pressable
                    key={device.id}
                    style={styles.deviceRow}
                    onPress={() => handleConnectDevice(device.id)}
                  >
                    <Ionicons name="heart-outline" size={20} color={Colors.primary} />
                    <Text style={styles.deviceName}>{device.name}</Text>
                    {connectingDeviceId === device.id && (
                      <Text style={styles.connectingLabel}>Connecting...</Text>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Pressable style={styles.modalClose} onPress={() => { bleService.stopScan(); setHRModalVisible(false); }}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MetricCell({
  label,
  value,
  unit,
  valueStyle,
}: {
  label: string;
  value: string;
  unit?: string;
  valueStyle?: object;
}) {
  return (
    <View style={styles.metricCell}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, valueStyle]}>{value}</Text>
        {unit && <Text style={styles.metricUnit}>{unit}</Text>}
      </View>
    </View>
  );
}

function getHRZoneColor(bpm: number): string {
  // Rough zones based on typical max HR ~185
  const maxHR = 185;
  const pct = bpm / maxHR;
  if (pct < 0.6) return '#6CABDD'; // Zone 1 - blue
  if (pct < 0.7) return '#4CAF50'; // Zone 2 - green
  if (pct < 0.8) return '#FFC107'; // Zone 3 - amber
  if (pct < 0.9) return '#FF9800'; // Zone 4 - orange
  return '#F44336';                 // Zone 5 - red
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  metricsPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: 12 },
  heroValue: { fontSize: 52, fontWeight: '700', color: Colors.textPrimary, fontVariant: ['tabular-nums'] },
  heroUnit: { fontSize: 20, fontWeight: '500', color: Colors.textSecondary, marginLeft: 6 },
  metricRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  metricDivider: { width: 1, height: 36, backgroundColor: '#E0E0E0' },
  metricCell: { flex: 1, alignItems: 'center' },
  metricLabel: { fontSize: 11, color: Colors.textSecondary, marginBottom: 2 },
  metricValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  metricValue: { fontSize: 20, fontWeight: '600', color: Colors.textPrimary, fontVariant: ['tabular-nums'] },
  metricUnit: { fontSize: 11, color: Colors.textSecondary },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  bigBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtn: { backgroundColor: '#4CAF50', width: 120, height: 56, borderRadius: 28 },
  pauseBtn: { backgroundColor: Colors.primary },
  resumeBtn: { backgroundColor: '#4CAF50' },
  bigBtnText: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  controlBtn: { width: 56, alignItems: 'center', gap: 4 },
  controlBtnLabel: { fontSize: 11, color: Colors.textSecondary },
  hrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 4,
  },
  hrRowText: { fontSize: 12, color: Colors.textSecondary },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 300,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16 },
  noDevices: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  noDevicesText: { color: Colors.textSecondary, fontSize: 14 },
  deviceList: { maxHeight: 200 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  deviceName: { flex: 1, fontSize: 15, color: Colors.textPrimary },
  connectingLabel: { fontSize: 12, color: Colors.textSecondary },
  modalClose: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
  },
  modalCloseText: { color: Colors.textPrimary, fontWeight: '600' },
});
