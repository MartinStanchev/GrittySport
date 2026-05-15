import { Platform } from 'react-native';
import type { GPSPoint, HRReading } from '../types/gps';
import type { WorkoutFileParseResult } from './workoutFileParser';
import { computeElevationGain, haversineMetres } from './gpsUtils';

const IS_ANDROID = Platform.OS === 'android';

// ── Activity type mapping ────────────────────────────────────────────────────

// Health Connect ExerciseType numeric enum → canonical activity_type strings.
// Source: androidx.health.connect.client.records.ExerciseSessionRecord.
const EXERCISE_TYPE_TO_ACTIVITY: Record<number, string> = {
  8: 'cycling',             // BIKING
  9: 'indoor_cycling',      // BIKING_STATIONARY
  10: 'strength_training',  // BOOT_CAMP
  13: 'strength_training',  // CALISTHENICS
  16: 'cross_training',     // DANCING
  25: 'indoor_run',         // ELLIPTICAL
  26: 'cross_training',     // EXERCISE_CLASS
  36: 'cross_training',     // HIGH_INTENSITY_INTERVAL_TRAINING
  37: 'walk',               // HIKING
  48: 'mobility',           // PILATES
  53: 'cross_training',     // ROWING
  54: 'cross_training',     // ROWING_MACHINE
  56: 'run',                // RUNNING
  57: 'indoor_run',         // RUNNING_TREADMILL
  68: 'walk',               // STAIR_CLIMBING
  69: 'indoor_run',         // STAIR_CLIMBING_MACHINE
  70: 'strength_training',  // STRENGTH_TRAINING
  71: 'mobility',           // STRETCHING
  73: 'open_water_swim',    // SWIMMING_OPEN_WATER
  74: 'swim',               // SWIMMING_POOL
  79: 'walk',               // WALKING
  81: 'strength_training',  // WEIGHTLIFTING
  83: 'yoga',               // YOGA
};

// Numeric → human-readable enum name, used as the canonical `type` string on
// the parse result (downstream `detectActivityType` lowercases and matches).
const EXERCISE_TYPE_NAMES: Record<number, string> = {
  0: 'other_workout', 2: 'badminton', 4: 'baseball', 5: 'basketball',
  8: 'biking', 9: 'biking_stationary', 10: 'boot_camp', 11: 'boxing',
  13: 'calisthenics', 14: 'cricket', 16: 'dancing', 25: 'elliptical',
  26: 'exercise_class', 27: 'fencing', 28: 'football_american',
  29: 'football_australian', 31: 'frisbee_disc', 32: 'golf',
  33: 'guided_breathing', 34: 'gymnastics', 35: 'handball',
  36: 'high_intensity_interval_training', 37: 'hiking', 38: 'ice_hockey',
  39: 'ice_skating', 44: 'martial_arts', 46: 'paddling', 47: 'paragliding',
  48: 'pilates', 50: 'racquetball', 51: 'rock_climbing', 52: 'roller_hockey',
  53: 'rowing', 54: 'rowing_machine', 55: 'rugby', 56: 'running',
  57: 'running_treadmill', 58: 'sailing', 59: 'scuba_diving', 60: 'skating',
  61: 'skiing', 62: 'snowboarding', 63: 'snowshoeing', 64: 'soccer',
  65: 'softball', 66: 'squash', 68: 'stair_climbing',
  69: 'stair_climbing_machine', 70: 'strength_training', 71: 'stretching',
  72: 'surfing', 73: 'swimming_open_water', 74: 'swimming_pool',
  75: 'table_tennis', 76: 'tennis', 78: 'volleyball', 79: 'walking',
  80: 'water_polo', 81: 'weightlifting', 82: 'wheelchair', 83: 'yoga',
};

export function resolveExerciseTypeName(exerciseType: number): string {
  return EXERCISE_TYPE_NAMES[exerciseType] ?? `exercise_${exerciseType}`;
}

export function mapHealthConnectExerciseType(exerciseType: number): string {
  return EXERCISE_TYPE_TO_ACTIVITY[exerciseType] ?? 'outdoor_activity';
}

// ── Normalized workout representation ────────────────────────────────────────

export interface HealthConnectWorkoutSummary {
  recordId: string;
  exerciseType: number;
  exerciseTypeName: string;
  mappedActivityType: string;
  startDate: Date;
  endDate: Date;
  durationSeconds: number;
  distanceKm: number | null;
  totalEnergyBurnedKcal: number | null;
  sourceDevice: string | null;
  title: string | null;
}

// ── Service (lazy-loaded to avoid native bridge crash off-Android) ───────────

// Native module is lazy-loaded so iOS / web bundles don't pull it in. Typed as
// `any` because the package is only present in the Android EAS build.
type HCModule = any;
let _hc: HCModule | null = null;
let _hcUnavailable = false;
let _initialized = false;

function getHC(): HCModule {
  if (!IS_ANDROID || _hcUnavailable) throw new Error('Health Connect not available');
  if (!_hc) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      _hc = require('react-native-health-connect');
    } catch {
      _hcUnavailable = true;
      throw new Error('Health Connect not available (requires Android development build)');
    }
  }
  return _hc;
}

// SdkAvailabilityStatus from react-native-health-connect/constants.ts:
//   1 = SDK_UNAVAILABLE, 2 = SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED, 3 = SDK_AVAILABLE
const SDK_AVAILABLE = 3;
const SDK_UPDATE_REQUIRED = 2;

export type HealthConnectStatus =
  | 'available'
  | 'needs_install'
  | 'needs_update'
  | 'needs_dev_build'
  | 'not_supported';

async function ensureInitialized(hc: HCModule): Promise<void> {
  if (_initialized) return;
  await hc.initialize();
  _initialized = true;
}

export async function checkAvailability(): Promise<HealthConnectStatus> {
  if (!IS_ANDROID) return 'not_supported';
  if (_hcUnavailable) return 'needs_dev_build';
  try {
    const hc = getHC();
    const status = await hc.getSdkStatus();
    if (status === SDK_AVAILABLE) return 'available';
    if (status === SDK_UPDATE_REQUIRED) return 'needs_update';
    return 'needs_install';
  } catch {
    return 'needs_dev_build';
  }
}

export async function isAvailable(): Promise<boolean> {
  return (await checkAvailability()) === 'available';
}

export function openSettings(): void {
  try {
    getHC().openHealthConnectSettings();
  } catch {
    // no-op when module unavailable; caller already gates on availability.
  }
}

const READ_PERMISSIONS = [
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
  { accessType: 'read', recordType: 'ExerciseRoute' },
] as const;

export async function requestPermissions(): Promise<boolean> {
  const hc = getHC();
  await ensureInitialized(hc);
  const granted = await hc.requestPermission(READ_PERMISSIONS as any);
  return Array.isArray(granted) && granted.length > 0;
}

// ── Workout reads ────────────────────────────────────────────────────────────

function summarizeSession(s: any): HealthConnectWorkoutSummary {
  const startDate = new Date(s.startTime);
  const endDate = new Date(s.endTime);
  const exerciseType: number = typeof s.exerciseType === 'number' ? s.exerciseType : 0;
  const typeName = resolveExerciseTypeName(exerciseType);

  return {
    recordId: s.metadata?.id ?? '',
    exerciseType,
    exerciseTypeName: typeName,
    mappedActivityType: mapHealthConnectExerciseType(exerciseType),
    startDate,
    endDate,
    durationSeconds: Math.max(0, (endDate.getTime() - startDate.getTime()) / 1000),
    distanceKm: null,
    totalEnergyBurnedKcal: null,
    sourceDevice: s.metadata?.dataOrigin ?? null,
    title: s.title ?? null,
  };
}

export async function getRecentWorkouts(
  since: Date,
): Promise<HealthConnectWorkoutSummary[]> {
  const hc = getHC();
  await ensureInitialized(hc);

  const result = await hc.readRecords('ExerciseSession', {
    timeRangeFilter: {
      operator: 'between',
      startTime: since.toISOString(),
      endTime: new Date().toISOString(),
    },
    ascendingOrder: false,
    pageSize: 100,
  } as any);

  const records: any[] = (result as any)?.records ?? [];
  const summaries = records
    .filter((s) => s && s.startTime && s.endTime)
    .map(summarizeSession)
    .filter((s) => s.durationSeconds >= 60 && !!s.recordId);

  // Enrich with distance + calories per session, in parallel.
  await Promise.all(
    summaries.map(async (s) => {
      const [distM, kcal] = await Promise.all([
        sumDistanceMetres(s.startDate, s.endDate).catch(() => 0),
        sumCalorieKcal(s.startDate, s.endDate).catch(() => 0),
      ]);
      s.distanceKm = distM > 0 ? distM / 1000 : null;
      s.totalEnergyBurnedKcal = kcal > 0 ? kcal : null;
    }),
  );

  return summaries;
}

export async function getWorkoutById(
  recordId: string,
): Promise<HealthConnectWorkoutSummary | null> {
  const hc = getHC();
  await ensureInitialized(hc);

  try {
    const record = await hc.readRecord('ExerciseSession', recordId);
    if (!record) return null;
    const summary = summarizeSession({ ...record, metadata: (record as any).metadata ?? { id: recordId } });
    const [distM, kcal] = await Promise.all([
      sumDistanceMetres(summary.startDate, summary.endDate).catch(() => 0),
      sumCalorieKcal(summary.startDate, summary.endDate).catch(() => 0),
    ]);
    summary.distanceKm = distM > 0 ? distM / 1000 : null;
    summary.totalEnergyBurnedKcal = kcal > 0 ? kcal : null;
    return summary;
  } catch {
    return null;
  }
}

export async function getWorkoutHeartRate(
  startDate: Date,
  endDate: Date,
): Promise<HRReading[]> {
  const hc = getHC();
  await ensureInitialized(hc);

  const result = await hc.readRecords('HeartRate', {
    timeRangeFilter: {
      operator: 'between',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    },
    ascendingOrder: true,
    pageSize: 5000,
  } as any);

  const records: any[] = (result as any)?.records ?? [];
  const readings: HRReading[] = [];
  for (const r of records) {
    const samples: any[] = r.samples ?? [];
    for (const s of samples) {
      if (typeof s.beatsPerMinute === 'number' && s.time) {
        readings.push({
          bpm: Math.round(s.beatsPerMinute),
          timestamp: new Date(s.time).getTime(),
        });
      }
    }
  }
  return readings;
}

export async function getWorkoutRoute(recordId: string): Promise<GPSPoint[]> {
  const hc = getHC();
  await ensureInitialized(hc);

  try {
    const route = await hc.requestExerciseRoute(recordId);
    const locs: any[] = (route as any)?.route ?? (route as any)?.locations ?? [];
    if (locs.length === 0) return [];

    const points: GPSPoint[] = locs.map((loc: any) => ({
      lat: loc.latitude,
      lng: loc.longitude,
      altitude: loc.altitude?.inMeters ?? loc.altitude ?? null,
      accuracy: loc.horizontalAccuracy?.inMeters ?? loc.horizontalAccuracy ?? 10,
      speed: null,
      timestamp: new Date(loc.time).getTime(),
      distance_from_prev: 0,
    }));

    for (let i = 1; i < points.length; i++) {
      points[i].distance_from_prev = haversineMetres(points[i - 1], points[i]);
    }
    return points;
  } catch {
    return [];
  }
}

// ── Aggregate helpers ────────────────────────────────────────────────────────

async function sumDistanceMetres(startDate: Date, endDate: Date): Promise<number> {
  const hc = getHC();
  const result = await hc.readRecords('Distance', {
    timeRangeFilter: {
      operator: 'between',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    },
    pageSize: 1000,
  } as any);
  const records: any[] = (result as any)?.records ?? [];
  let total = 0;
  for (const r of records) {
    const m = r.distance?.inMeters;
    if (typeof m === 'number') total += m;
  }
  return total;
}

async function sumCalorieKcal(startDate: Date, endDate: Date): Promise<number> {
  const hc = getHC();
  const result = await hc.readRecords('TotalCaloriesBurned', {
    timeRangeFilter: {
      operator: 'between',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    },
    pageSize: 1000,
  } as any);
  const records: any[] = (result as any)?.records ?? [];
  let total = 0;
  for (const r of records) {
    const kcal = r.energy?.inKilocalories;
    if (typeof kcal === 'number') total += kcal;
  }
  return total;
}

// ── Build shared WorkoutFileParseResult ──────────────────────────────────────

export function buildHealthConnectParseResult(
  summary: HealthConnectWorkoutSummary,
  hrReadings: HRReading[],
  gpsPoints: GPSPoint[],
): WorkoutFileParseResult {
  const totalDistanceM = gpsPoints.length > 0
    ? gpsPoints.reduce((s, p) => s + p.distance_from_prev, 0)
    : (summary.distanceKm ?? 0) * 1000;

  return {
    name: summary.title || 'Health Connect Workout',
    type: summary.exerciseTypeName,
    sourceFormat: 'health_connect',
    points: gpsPoints,
    hrReadings,
    cadenceReadings: [],
    powerReadings: [],
    laps: [],
    startTime: summary.startDate,
    endTime: summary.endDate,
    totalDistanceM,
    durationSec: summary.durationSeconds,
    elevationGainM: computeElevationGain(gpsPoints),
    caloriesKcal: summary.totalEnergyBurnedKcal ?? undefined,
    sourceDevice: summary.sourceDevice ?? undefined,
  };
}

