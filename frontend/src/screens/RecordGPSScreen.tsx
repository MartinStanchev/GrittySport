import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from '../components/NativeMap';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { formatTime } from '../constants/workoutUtils';
import { useWorkout } from '../contexts/WorkoutContext';
import { useAuth } from '../contexts/AuthContext';
import type { ActiveGPSWorkout } from '../contexts/WorkoutContext';
import type { ThemeColors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import {
  triggerLap,
  formatPaceSecPerKm,
  formatSpeedKph,
  formatDistanceKm,
  isRunSport,
  getHRZoneColor,
} from '../services/gpsUtils';
import { applyGPSPoint } from '../services/gpsReducer';
import { locationTracking } from '../services/locationTrackingService';
import { bleService } from '../services/bleService';
import { cadenceService } from '../services/cadenceService';
import HRSensorModal from '../components/HRSensorModal';
import type { CadenceReading } from '../types/gps';
import {
  formatLiveWorkoutType,
  getGPSQualityState,
  getRecordingStatusLabel,
  buildNorthUpCamera,
  getLiveMapPadding,
  getCollapsedMetricPages,
  type CollapsedMetricId,
  type CollapsedMetricSlot,
} from '../utils/liveWorkout';

export type RecordGPSParams = {
  scheduledActivityId?: string;
  activityType: string;
};

type Props = NativeStackScreenProps<any, 'RecordGPS'>;

const COLLAPSED_PANEL_PEEK = 232;

export default function RecordGPSScreen({ route, navigation }: Props) {
  const params = route.params as RecordGPSParams | undefined;
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const { activeGPSWorkout, startGPSWorkout, updateGPSWorkout, clearGPSWorkout, workoutMode } = useWorkout();
  const { user } = useAuth();
  const maxHR = user?.max_heart_rate ?? 185;

  const activityType = params?.activityType ?? activeGPSWorkout?.activityType ?? '';
  const scheduledActivityId = params?.scheduledActivityId ?? activeGPSWorkout?.scheduledActivityId;
  const isRun = isRunSport(activityType);

  const mapRef = useRef<any>(null);
  const hrReadingsRef = useRef<{ bpm: number; timestamp: number }[]>([]);
  const hrSumRef = useRef(0);
  const cadenceReadingsRef = useRef<CadenceReading[]>([]);
  const showCadence = isRun || activityType === 'walk';
  const gpsWorkoutRef = useRef<ActiveGPSWorkout | null>(null);
  gpsWorkoutRef.current = activeGPSWorkout;
  const metricsExpandedRef = useRef(false);
  const userMovedMapRef = useRef(false);
  const followTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [hrModalVisible, setHRModalVisible] = useState(false);
  const [previewHR, setPreviewHR] = useState<number | null>(null);
  const [previewDeviceName, setPreviewDeviceName] = useState<string | null>(null);
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  metricsExpandedRef.current = metricsExpanded;
  const [userMovedMap, setUserMovedMap] = useState(false);
  const [previewPosition, setPreviewPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activeMetricPage, setActiveMetricPage] = useState(0);
  const [pagerWidth, setPagerWidth] = useState(0);

  const workout = activeGPSWorkout;
  const recordingState = workout?.recordingState ?? 'idle';

  useEffect(() => {
    if (workoutMode === 'manual') {
      Alert.alert(
        'Workout In Progress',
        'A manual workout is already active. Finish it before starting a GPS session.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
      return;
    }

    if (activeGPSWorkout !== null) {
      const p = params;
      const isDifferent =
        p?.scheduledActivityId !== undefined &&
        p.scheduledActivityId !== activeGPSWorkout.scheduledActivityId;
      if (isDifferent) {
        Alert.alert(
          'GPS Session Active',
          'Finish your current GPS activity before starting a new one.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      }
      return;
    }

    return () => {
      void locationTracking.stop();
      cadenceService.stop();
      if (followTimerRef.current) clearTimeout(followTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPreviewPosition({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      mapRef.current?.animateToRegion(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        300,
      );
    })();
  }, []);

  const handleUserLocationChange = useCallback((event: { nativeEvent?: { coordinate?: { latitude: number; longitude: number } } }) => {
    const coordinate = event.nativeEvent?.coordinate;
    if (!coordinate) return;
    setPreviewPosition({ latitude: coordinate.latitude, longitude: coordinate.longitude });
  }, []);

  const startedAtMs = workout?.startedAt?.getTime();
  const pausedDurationSec = workout?.autoPausedDurationSec ?? 0;

  useEffect(() => {
    if (!startedAtMs || recordingState !== 'recording') return;
    const interval = setInterval(() => {
      const rawElapsed = (Date.now() - startedAtMs) / 1000;
      setElapsed(Math.floor(rawElapsed - pausedDurationSec));
    }, 1000);
    return () => clearInterval(interval);
  }, [pausedDurationSec, recordingState, startedAtMs]);

  // Drains everything the background location task buffered and folds it through the
  // pure GPS reducer. Runs both live (one reading at a time) and on foreground resume,
  // when a lock-screen gap has buffered a whole batch. `gpsWorkoutRef` is written
  // synchronously so rapid back-to-back drains fold onto the latest state, not the last
  // rendered one.
  const drainLocations = useCallback(() => {
    const readings = locationTracking.drain();
    const base = gpsWorkoutRef.current;
    if (!base || readings.length === 0) return;

    const next = readings.reduce(applyGPSPoint, base);
    if (next === base) return;

    gpsWorkoutRef.current = next;
    updateGPSWorkout(next);

    const lastPoint = next.points[next.points.length - 1];
    if (lastPoint && !userMovedMapRef.current) {
      mapRef.current?.animateToRegion(
        { latitude: lastPoint.lat, longitude: lastPoint.lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
        300,
      );
    }
  }, [updateGPSWorkout]);

  const handleMapPanDrag = useCallback(() => {
    userMovedMapRef.current = true;
    setUserMovedMap(true);
    if (followTimerRef.current) clearTimeout(followTimerRef.current);
    followTimerRef.current = setTimeout(() => {
      userMovedMapRef.current = false;
      setUserMovedMap(false);
    }, 5000);
  }, []);

  // The background task buffers readings at module scope; this screen drains them live
  // and again whenever it returns to the foreground after a lock-screen gap.
  useEffect(() => {
    locationTracking.setListener(drainLocations);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') drainLocations();
    });
    return () => {
      locationTracking.setListener(null);
      sub.remove();
    };
  }, [drainLocations]);

  const handleStart = useCallback(async () => {
    const displayType = formatLiveWorkoutType(activityType);
    const result = await locationTracking.start();
    if (!result.ok) {
      Alert.alert('Permission Required', result.reason ?? 'Location access is needed to track your workout.');
      return;
    }

    startGPSWorkout({ activityType, activityDisplayType: displayType, scheduledActivityId, startedAt: new Date() });
    updateGPSWorkout({ recordingState: 'recording' });

    if (showCadence) {
      cadenceService.start((spm) => {
        const now = Date.now();
        cadenceReadingsRef.current = [...cadenceReadingsRef.current, { spm, timestamp: now }];
        const avg = Math.round(
          cadenceReadingsRef.current.reduce((sum, reading) => sum + reading.spm, 0) / cadenceReadingsRef.current.length,
        );
        updateGPSWorkout({ cadenceReadings: cadenceReadingsRef.current, currentCadence: spm, avgCadence: avg });
      });
    }
  }, [activityType, scheduledActivityId, showCadence, startGPSWorkout, updateGPSWorkout]);

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
      slowPointCount: 0,
    });
  }, [updateGPSWorkout]);

  const handleStop = useCallback(() => {
    Alert.alert('Finish Workout?', 'Are you sure you want to finish this workout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        style: 'destructive',
        onPress: () => {
          void locationTracking.stop();
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
  }, [navigation, updateGPSWorkout]);

  const handleManualLap = useCallback(() => {
    const gpsWorkout = gpsWorkoutRef.current;
    if (!gpsWorkout || gpsWorkout.points.length === 0) return;
    const lap = triggerLap(
      gpsWorkout.points,
      gpsWorkout.lapStartIndex,
      gpsWorkout.laps,
      gpsWorkout.hrReadings,
    );
    updateGPSWorkout({
      laps: [...gpsWorkout.laps, lap],
      lapStartIndex: gpsWorkout.points.length - 1,
      lapStartDistanceM: gpsWorkout.totalDistanceM,
    });
  }, [updateGPSWorkout]);

  const handleDiscard = useCallback(() => {
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
          void locationTracking.stop();
          bleService.disconnect();
          cadenceService.stop();
          clearGPSWorkout();
          navigation.goBack();
        },
      },
    ]);
  }, [clearGPSWorkout, navigation]);

  const handleHRReading = useCallback((bpm: number) => {
    setPreviewHR(bpm);
    if (!gpsWorkoutRef.current) return;
    const now = Date.now();
    hrReadingsRef.current = [...hrReadingsRef.current, { bpm, timestamp: now }];
    hrSumRef.current += bpm;
    const avg = Math.round(hrSumRef.current / hrReadingsRef.current.length);
    updateGPSWorkout({ hrReadings: hrReadingsRef.current, currentHR: bpm, avgHR: avg });
  }, [updateGPSWorkout]);

  const handleHRConnected = useCallback((deviceName: string) => {
    setPreviewDeviceName(deviceName);
    updateGPSWorkout({ hrDeviceName: deviceName });
  }, [updateGPSWorkout]);

  const handleHRModalClose = useCallback(() => {
    setHRModalVisible(false);
    if (!bleService.isConnected()) {
      setPreviewHR(null);
      setPreviewDeviceName(null);
    }
  }, []);

  const handleRecenter = useCallback(async () => {
    const gpsWorkout = gpsWorkoutRef.current;
    const last = gpsWorkout && gpsWorkout.points.length > 0
      ? gpsWorkout.points[gpsWorkout.points.length - 1]
      : null;
    const target = last
      ? { latitude: last.lat, longitude: last.lng }
      : previewPosition;

    if (target) {
      try {
        const currentCamera = await mapRef.current?.getCamera?.();
        mapRef.current?.animateCamera(buildNorthUpCamera(target, currentCamera), { duration: 300 });
      } catch {
        mapRef.current?.animateCamera(buildNorthUpCamera(target), { duration: 300 });
      }
    }

    userMovedMapRef.current = false;
    setUserMovedMap(false);
    if (followTimerRef.current) clearTimeout(followTimerRef.current);
  }, [previewPosition]);

  const polylineCoords = useMemo(
    () => (workout?.points ?? []).map((point) => ({ latitude: point.lat, longitude: point.lng })),
    [workout?.points],
  );

  const lastPoint = workout && workout.points.length > 0 ? workout.points[workout.points.length - 1] : null;
  const currentPosition = lastPoint ? { latitude: lastPoint.lat, longitude: lastPoint.lng } : previewPosition;
  const activityLabel = workout?.activityDisplayType ?? formatLiveWorkoutType(activityType || 'run');
  const statusLabel = getRecordingStatusLabel(recordingState);
  const gpsQuality = recordingState === 'idle'
    ? { label: 'Ready', tone: 'fair' as const }
    : getGPSQualityState(lastPoint?.accuracy, Boolean(lastPoint));
  const displayHR = workout?.currentHR ?? previewHR;
  const hrZoneColor = displayHR ? getHRZoneColor(displayHR, maxHR) : colors.textSecondary;
  const qualityColor = getQualityColor(gpsQuality.tone, colors);
  const primaryMetricTone = recordingState === 'recording' ? colors.secondary : colors.primary;
  const mapOverlay = isDark ? 'rgba(17, 17, 26, 0.78)' : 'rgba(255, 255, 255, 0.82)';
  const mapScrimColor = isDark ? 'rgba(12, 11, 18, 0.18)' : 'rgba(245, 243, 255, 0.12)';
  const collapsedPillBg = isDark ? 'rgba(17, 17, 26, 0.88)' : 'rgba(255, 255, 255, 0.92)';
  const connectionLabel = bleService.isConnected()
    ? `Connected to ${workout?.hrDeviceName ?? previewDeviceName ?? bleService.getDeviceName()}`
    : 'Connect heart rate monitor';
  const expandedPanelHeight = Math.min(Math.max(560, windowHeight * 0.72), 700);
  const collapsedTranslateY = Math.max(expandedPanelHeight - COLLAPSED_PANEL_PEEK, 0);
  const panelTranslateY = useRef(new Animated.Value(collapsedTranslateY)).current;
  const translateYRef = useRef(collapsedTranslateY);
  const dragStartRef = useRef(collapsedTranslateY);
  const liveMapPadding = useMemo(
    () => getLiveMapPadding(insets.top, insets.bottom, COLLAPSED_PANEL_PEEK),
    [insets.bottom, insets.top],
  );

  useEffect(() => {
    const listenerId = panelTranslateY.addListener(({ value }) => {
      translateYRef.current = value;
    });
    return () => {
      panelTranslateY.removeListener(listenerId);
    };
  }, [panelTranslateY]);

  useEffect(() => {
    const nextValue = metricsExpandedRef.current ? 0 : collapsedTranslateY;
    panelTranslateY.setValue(nextValue);
    translateYRef.current = nextValue;
    dragStartRef.current = nextValue;
  }, [collapsedTranslateY, panelTranslateY]);

  const animatePanel = useCallback((expand: boolean) => {
    setMetricsExpanded(expand);
    Animated.spring(panelTranslateY, {
      toValue: expand ? 0 : collapsedTranslateY,
      damping: 22,
      mass: 0.9,
      stiffness: 190,
      overshootClamping: true,
      useNativeDriver: true,
    }).start(() => {
      translateYRef.current = expand ? 0 : collapsedTranslateY;
      dragStartRef.current = translateYRef.current;
    });
  }, [collapsedTranslateY, panelTranslateY]);

  const sheetPanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_evt, gesture) =>
      Math.abs(gesture.dy) > Math.abs(gesture.dx) && Math.abs(gesture.dy) > 6,
    onPanResponderGrant: () => {
      dragStartRef.current = translateYRef.current;
    },
    onPanResponderMove: (_evt, gesture) => {
      const nextValue = Math.min(Math.max(dragStartRef.current + gesture.dy, 0), collapsedTranslateY);
      panelTranslateY.setValue(nextValue);
    },
    onPanResponderRelease: (_evt, gesture) => {
      const currentValue = translateYRef.current;
      const expand = gesture.vy < -0.35 || gesture.dy < -40 || currentValue < collapsedTranslateY * 0.5;
      animatePanel(expand);
    },
    onPanResponderTerminate: () => {
      animatePanel(translateYRef.current < collapsedTranslateY * 0.5);
    },
  }), [animatePanel, collapsedTranslateY, panelTranslateY]);

  const secondaryContentOpacity = panelTranslateY.interpolate({
    inputRange: [0, collapsedTranslateY * 0.7, collapsedTranslateY],
    outputRange: [1, 0.12, 0],
    extrapolate: 'clamp',
  });

  const panelBgOpacity = panelTranslateY.interpolate({
    inputRange: [0, collapsedTranslateY * 0.5, collapsedTranslateY],
    outputRange: [1, 0.15, 0],
    extrapolate: 'clamp',
  });

  const chevronOpacity = panelTranslateY.interpolate({
    inputRange: [0, collapsedTranslateY * 0.3, collapsedTranslateY],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  const handleBarOpacity = panelTranslateY.interpolate({
    inputRange: [0, collapsedTranslateY * 0.3],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const metricPages = useMemo(
    () => getCollapsedMetricPages(isRun, showCadence),
    [isRun, showCadence],
  );

  function resolveMetricValue(id: CollapsedMetricId): string {
    switch (id) {
      case 'distance': return formatDistanceKm(workout?.totalDistanceM ?? 0);
      case 'pace': return formatPaceSecPerKm(workout?.currentPaceSecPerKm ?? 0);
      case 'speed': return formatSpeedKph(workout?.currentSpeedKph ?? 0);
      case 'avg_pace': return formatPaceSecPerKm(workout?.avgPaceSecPerKm ?? 0);
      case 'avg_speed': return formatSpeedKph(workout?.avgSpeedKph ?? 0);
      case 'heart_rate': return displayHR ? String(displayHR) : '\u2014';
      case 'cadence': return workout?.currentCadence ? String(workout.currentCadence) : '\u2014';
      case 'elevation': return String(Math.round(workout?.elevationGainM ?? 0));
      case 'lap': return String((workout?.laps.length ?? 0) + 1);
      default: return '\u2014';
    }
  }

  function getMetricUnit(slot: CollapsedMetricSlot): string | undefined {
    if (slot.id === 'heart_rate' && !displayHR) return undefined;
    if (slot.id === 'cadence' && !workout?.currentCadence) return undefined;
    return slot.unit;
  }

  function getMetricAccent(id: CollapsedMetricId): string {
    switch (id) {
      case 'distance': return colors.primary;
      case 'pace': case 'speed': return colors.secondary;
      case 'avg_pace': case 'avg_speed': return colors.primary;
      case 'heart_rate': return hrZoneColor;
      case 'cadence': return colors.secondary;
      case 'elevation': return colors.tertiary;
      case 'lap': return colors.primary;
      default: return colors.textSecondary;
    }
  }

  const secondaryMetrics = [
    {
      label: isRun ? 'Avg Pace' : 'Avg Speed',
      value: resolveMetricValue(isRun ? 'avg_pace' : 'avg_speed'),
      unit: isRun ? '/km' : 'km/h',
      accent: getMetricAccent(isRun ? 'avg_pace' : 'avg_speed'),
      support: recordingState === 'idle' ? 'Builds as you move' : 'Session average',
    },
    {
      label: 'Heart Rate',
      value: resolveMetricValue('heart_rate'),
      unit: getMetricUnit({ id: 'heart_rate', label: 'HR', unit: 'bpm' }),
      accent: getMetricAccent('heart_rate'),
      support: workout?.avgHR
        ? `Avg ${workout.avgHR} bpm`
        : displayHR
          ? 'Live reading'
          : 'Sensor optional',
    },
    ...(showCadence
      ? [{
        label: 'Cadence',
        value: resolveMetricValue('cadence'),
        unit: getMetricUnit({ id: 'cadence', label: 'Cadence', unit: 'spm' }),
        accent: getMetricAccent('cadence'),
        support: workout?.avgCadence ? `Avg ${workout.avgCadence} spm` : 'Run rhythm',
      }]
      : []),
    {
      label: 'Elevation',
      value: resolveMetricValue('elevation'),
      unit: 'm',
      accent: getMetricAccent('elevation'),
      support: 'Climbed so far',
    },
    {
      label: 'Lap',
      value: resolveMetricValue('lap'),
      accent: getMetricAccent('lap'),
      support: workout?.laps.length ? `${workout.laps.length} complete` : 'Auto-lap each km',
    },
    {
      label: 'GPS Points',
      value: String(workout?.points.length ?? 0),
      accent: qualityColor,
      support: gpsQuality.label,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.mapSection}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          mapType={Platform.OS === 'android' ? 'none' : 'standard'}
          mapPadding={liveMapPadding}
          showsUserLocation={recordingState === 'idle'}
          followsUserLocation={false}
          onPanDrag={handleMapPanDrag}
          onUserLocationChange={handleUserLocationChange}
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
            <Polyline coordinates={polylineCoords} strokeColor={colors.secondary} strokeWidth={5} />
          )}
          {currentPosition && (
            <Marker coordinate={currentPosition} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={[styles.markerOuter, { backgroundColor: `${colors.primary}30` }]}>
                <View style={[styles.markerInner, { backgroundColor: colors.secondary }]} />
              </View>
            </Marker>
          )}
        </MapView>

        <View style={[styles.mapScrim, { backgroundColor: mapScrimColor }]} pointerEvents="none" />

        <View style={[styles.topBar, { top: insets.top + 12 }]}>
          <Pressable
            style={[styles.iconButton, { backgroundColor: mapOverlay }]}
            onPress={handleDiscard}
          >
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </Pressable>

          <View style={[styles.sessionBadge, { backgroundColor: mapOverlay }]}>
            <Text style={[styles.sessionTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {activityLabel.toUpperCase()}
            </Text>
            <View style={styles.sessionMetaRow}>
              <View style={[styles.liveDot, { backgroundColor: primaryMetricTone }]} />
              <Text style={[styles.sessionMetaText, { color: colors.textSecondary }]}>{statusLabel}</Text>
            </View>
          </View>

          <View style={[styles.qualityBadge, { backgroundColor: mapOverlay }]}>
            <Ionicons name="locate" size={14} color={qualityColor} />
            <Text style={[styles.qualityText, { color: colors.textPrimary }]}>{gpsQuality.label}</Text>
          </View>
        </View>

        {recordingState === 'paused' && workout && workout.points.length > 0 && (
          <View style={[styles.pauseChip, { top: insets.top + 82, backgroundColor: `${colors.tertiary}22` }]}>
            <Ionicons name="pause-circle" size={15} color={colors.tertiary} />
            <Text style={[styles.pauseChipText, { color: colors.textPrimary }]}>Auto-paused</Text>
          </View>
        )}

        <Pressable
          style={[
            styles.recenterButton,
            {
              top: insets.top + 84,
              backgroundColor: userMovedMap ? colors.surface : mapOverlay,
            },
          ]}
          onPress={handleRecenter}
          disabled={!currentPosition}
        >
          <Ionicons name={userMovedMap ? 'navigate' : 'locate'} size={18} color={colors.primary} />
        </Pressable>

      </View>

      <Animated.View
        style={[
          styles.bottomPanel,
          {
            height: expandedPanelHeight,
            paddingBottom: 0,
            transform: [{ translateY: panelTranslateY }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.panelBackground,
            { backgroundColor: colors.surface, opacity: panelBgOpacity },
          ]}
          pointerEvents="none"
        />

        <View style={styles.panelGestureZone} {...sheetPanResponder.panHandlers}>
          <View style={styles.panelHandleArea}>
            <Animated.View style={[styles.indicatorPosition, { opacity: handleBarOpacity }]}>
              <View style={[styles.panelHandle, { backgroundColor: `${colors.textSecondary}55` }]} />
            </Animated.View>
            <Animated.View style={[styles.indicatorPosition, { opacity: chevronOpacity }]}>
              <Ionicons name="chevron-up" size={16} color={`${colors.textSecondary}99`} />
            </Animated.View>
          </View>

          <View
            style={[
              styles.heroMetricsCard,
              metricsExpanded ? styles.heroMetricsCardExpanded : styles.heroMetricsCardCollapsed,
              { backgroundColor: metricsExpanded ? colors.surfaceAlt : collapsedPillBg },
            ]}
          >
            <View style={styles.heroMetricsRow}>
              <HeroMetric
                label="Time"
                value={formatTime(elapsed)}
                accent={primaryMetricTone}
                colors={colors}
                emphasized
              />
              <View
                style={styles.heroPagerContainer}
                onLayout={(e) => setPagerWidth(e.nativeEvent.layout.width)}
              >
                {pagerWidth > 0 && (
                  <ScrollView
                    horizontal
                    pagingEnabled
                    bounces={false}
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(e) => {
                      if (pagerWidth > 0) {
                        setActiveMetricPage(
                          Math.round(e.nativeEvent.contentOffset.x / pagerWidth),
                        );
                      }
                    }}
                  >
                    {metricPages.map((page, idx) => (
                      <View key={idx} style={[styles.heroPagerPage, { width: pagerWidth }]}>
                        <HeroMetric
                          label={page.left.label}
                          value={resolveMetricValue(page.left.id)}
                          unit={getMetricUnit(page.left)}
                          accent={getMetricAccent(page.left.id)}
                          colors={colors}
                        />
                        <HeroMetric
                          label={page.right.label}
                          value={resolveMetricValue(page.right.id)}
                          unit={getMetricUnit(page.right)}
                          accent={getMetricAccent(page.right.id)}
                          colors={colors}
                        />
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>
            {metricPages.length > 1 && (
              <View style={styles.pageDots}>
                {metricPages.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.pageDot,
                      {
                        backgroundColor: idx === activeMetricPage
                          ? colors.primary
                          : `${colors.textSecondary}40`,
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={styles.controlsDock}>
            {recordingState === 'idle' && (
              <Pressable style={[styles.primaryControl, { backgroundColor: colors.primary }]} onPress={handleStart}>
                <Ionicons name="play" size={18} color={colors.background} />
                <Text style={[styles.primaryControlText, { color: colors.background }]}>Start Workout</Text>
              </Pressable>
            )}

            {recordingState === 'recording' && (
              <View style={styles.controlsRow}>
                <ControlButton
                  icon="flag-outline"
                  label="Lap"
                  accent={colors.tertiary}
                  onPress={handleManualLap}
                  colors={colors}
                />
                <Pressable style={[styles.primaryControl, styles.primaryControlCompact, { backgroundColor: colors.secondary }]} onPress={handlePause}>
                  <Ionicons name="pause" size={18} color={colors.background} />
                  <Text style={[styles.primaryControlText, { color: colors.background }]}>Pause</Text>
                </Pressable>
                <ControlButton
                  icon="stop"
                  label="Finish"
                  accent={colors.primary}
                  onPress={handleStop}
                  colors={colors}
                />
              </View>
            )}

            {recordingState === 'paused' && (
              <View style={styles.controlsRow}>
                <ControlButton
                  icon="stop"
                  label="Finish"
                  accent={colors.primary}
                  onPress={handleStop}
                  colors={colors}
                />
                <Pressable style={[styles.primaryControl, styles.primaryControlCompact, { backgroundColor: colors.primary }]} onPress={handleResume}>
                  <Ionicons name="play" size={18} color={colors.background} />
                  <Text style={[styles.primaryControlText, { color: colors.background }]}>Resume</Text>
                </Pressable>
                <ControlButton
                  icon="trash-outline"
                  label="Discard"
                  accent={colors.error}
                  onPress={handleDiscard}
                  colors={colors}
                />
              </View>
            )}
          </View>
        </View>

        <Animated.View style={[styles.sheetContent, { opacity: secondaryContentOpacity }]}>
          <ScrollView
            style={styles.panelScroll}
            contentContainerStyle={styles.panelScrollContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={metricsExpanded}
          >
            <View style={styles.metricGrid}>
              {secondaryMetrics.map((metric) => (
                <SecondaryMetricCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  unit={metric.unit}
                  accent={metric.accent}
                  support={metric.support}
                  colors={colors}
                />
              ))}
            </View>

            <Pressable
              style={[styles.sensorRow, { backgroundColor: colors.surfaceAlt }]}
              onPress={() => setHRModalVisible(true)}
            >
              <View style={[styles.sensorIcon, { backgroundColor: `${hrZoneColor}20` }]}>
                <Ionicons
                  name={bleService.isConnected() ? 'heart' : 'heart-outline'}
                  size={15}
                  color={bleService.isConnected() ? hrZoneColor : colors.textSecondary}
                />
              </View>
              <View style={styles.sensorCopy}>
                <Text style={[styles.sensorTitle, { color: colors.textPrimary }]}>
                  Heart rate sensor
                </Text>
                <Text style={[styles.sensorSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                  {connectionLabel}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </Pressable>
          </ScrollView>
        </Animated.View>
      </Animated.View>

      <HRSensorModal
        visible={hrModalVisible}
        onClose={handleHRModalClose}
        onConnected={handleHRConnected}
        onReading={handleHRReading}
      />
    </View>
  );
}

function HeroMetric({
  label,
  value,
  unit,
  accent,
  colors,
  emphasized = false,
}: {
  label: string;
  value: string;
  unit?: string;
  accent: string;
  colors: ThemeColors;
  emphasized?: boolean;
}) {
  return (
    <View style={[styles.heroMetric, emphasized && styles.heroMetricWide]}>
      <View style={styles.heroLabelRow}>
        <View style={[styles.heroMetricDot, { backgroundColor: accent }]} />
        <Text style={[styles.heroMetricLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <View style={styles.heroValueRow}>
        <Text
          style={[
            styles.heroMetricValue,
            emphasized ? styles.heroMetricValueLarge : styles.heroMetricValueCompact,
            { color: colors.textPrimary },
          ]}
        >
          {value}
        </Text>
        {unit && <Text style={[styles.heroMetricUnit, { color: colors.textSecondary }]}>{unit}</Text>}
      </View>
    </View>
  );
}

function SecondaryMetricCard({
  label,
  value,
  unit,
  accent,
  support,
  colors,
}: {
  label: string;
  value: string;
  unit?: string;
  accent: string;
  support: string;
  colors: ThemeColors;
}) {
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.surfaceAlt }]}>
      <View style={styles.metricCardHeader}>
        <Text style={[styles.metricCardLabel, { color: colors.textSecondary }]}>{label}</Text>
        <View style={[styles.metricAccent, { backgroundColor: accent }]} />
      </View>
      <View style={styles.metricCardValueRow}>
        <Text style={[styles.metricCardValue, { color: colors.textPrimary }]}>{value}</Text>
        {unit && <Text style={[styles.metricCardUnit, { color: colors.textSecondary }]}>{unit}</Text>}
      </View>
      <Text style={[styles.metricCardSupport, { color: colors.textSecondary }]} numberOfLines={1}>
        {support}
      </Text>
    </View>
  );
}

function ControlButton({
  icon,
  label,
  accent,
  onPress,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accent: string;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <Pressable style={[styles.controlButton, { backgroundColor: colors.surfaceAlt }]} onPress={onPress}>
      <View style={[styles.controlIcon, { backgroundColor: `${accent}20` }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={[styles.controlButtonText, { color: colors.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

function getQualityColor(tone: 'good' | 'fair' | 'searching', colors: ThemeColors): string {
  switch (tone) {
    case 'good':
      return colors.secondary;
    case 'fair':
      return colors.tertiary;
    default:
      return colors.textSecondary;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapSection: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  mapScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionBadge: {
    minWidth: 124,
    maxWidth: 168,
    flexShrink: 1,
    marginRight: 'auto',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sessionTitle: {
    fontSize: 14,
    fontFamily: Fonts.heading,
    letterSpacing: 0.6,
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sessionMetaText: {
    fontSize: 12,
    fontFamily: Fonts.bodyMedium,
  },
  qualityBadge: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qualityText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
  },
  pauseChip: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pauseChipText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
  },
  recenterButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMetricsCard: {
    borderRadius: 28,
    padding: 18,
  },
  heroMetricsCardCollapsed: {
    paddingTop: 10,
  },
  heroMetricsCardExpanded: {
    marginBottom: 0,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 14,
  },
  heroPagerContainer: {
    flex: 2,
    overflow: 'hidden',
  },
  heroPagerPage: {
    flexDirection: 'row',
    gap: 14,
  },
  pageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  pageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroMetric: {
    flex: 1,
    justifyContent: 'space-between',
  },
  heroMetricWide: {
    flex: 1.2,
  },
  heroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  heroMetricDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  heroMetricLabel: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  heroMetricValue: {
    fontVariant: ['tabular-nums'],
  },
  heroMetricValueLarge: {
    fontSize: 32,
    fontFamily: Fonts.heading,
    letterSpacing: -0.4,
  },
  heroMetricValueCompact: {
    fontSize: 24,
    fontFamily: Fonts.heading,
    letterSpacing: -0.3,
  },
  heroMetricUnit: {
    fontSize: 12,
    fontFamily: Fonts.bodyMedium,
  },
  markerOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  panelBackground: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  panelGestureZone: {
    paddingBottom: 8,
  },
  panelHandleArea: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorPosition: {
    position: 'absolute',
  },
  panelHandle: {
    width: 52,
    height: 5,
    borderRadius: 999,
  },
  panelScroll: {
    flex: 1,
  },
  panelScrollContent: {
    paddingBottom: 24,
  },
  sheetContent: {
    flex: 1,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    minHeight: 108,
    borderRadius: 18,
    padding: 14,
    justifyContent: 'space-between',
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricCardLabel: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  metricAccent: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metricCardValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 8,
  },
  metricCardValue: {
    fontSize: 24,
    fontFamily: Fonts.heading,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  metricCardUnit: {
    fontSize: 12,
    fontFamily: Fonts.bodyMedium,
  },
  metricCardSupport: {
    fontSize: 12,
    fontFamily: Fonts.body,
    marginTop: 4,
  },
  sensorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    marginTop: 14,
  },
  sensorIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sensorCopy: {
    flex: 1,
  },
  sensorTitle: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
  },
  sensorSubtitle: {
    fontSize: 12,
    fontFamily: Fonts.body,
    marginTop: 1,
  },
  controlsDock: {
    marginTop: 14,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryControl: {
    borderRadius: 24,
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  primaryControlCompact: {
    flex: 1,
  },
  primaryControlText: {
    fontSize: 15,
    fontFamily: Fonts.heading,
    letterSpacing: 0.2,
  },
  controlButton: {
    width: 88,
    minHeight: 62,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
  },
  controlIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
  },
});
