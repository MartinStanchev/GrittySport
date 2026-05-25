import { LogBox, Platform } from 'react-native';
import type { GPSPoint, HRReading, CadenceReading, PowerReading, Lap } from '../types/gps';
import type { WorkoutFileParseResult } from './workoutFileParser';
import { computeElevationGain } from './gpsUtils';

const IS_IOS = Platform.OS === 'ios';

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  LogBox.ignoreLogs(['NitroModules are not supported']);
}

// ── Activity type mapping ────────────────────────────────────────────────────

// WorkoutActivityType enum values → our app's activity_type strings.
// The HK enum key names (e.g. "running") are used, not the numeric values.
const HEALTHKIT_TYPE_MAP: Record<string, string> = {
  running: 'run',
  cycling: 'cycling',
  swimming: 'swim',
  traditionalStrengthTraining: 'strength_training',
  functionalStrengthTraining: 'strength_training',
  walking: 'walk',
  yoga: 'yoga',
  hiking: 'run',
  coreTraining: 'strength_training',
  flexibility: 'mobility',
  highIntensityIntervalTraining: 'run',
  elliptical: 'indoor_run',
  crossTraining: 'cross_training',
  pilates: 'mobility',
  dance: 'mobility',
  rowing: 'cross_training',
  stairClimbing: 'walk',
  mixedCardio: 'cross_training',
};

// WorkoutActivityType numeric values → their string key names.
// Built from the enum definition so we can resolve the name at runtime.
const HK_ACTIVITY_NAMES: Record<number, string> = {
  1: 'americanFootball', 2: 'archery', 3: 'australianFootball', 4: 'badminton',
  5: 'baseball', 6: 'basketball', 7: 'bowling', 8: 'boxing', 9: 'climbing',
  10: 'cricket', 11: 'crossTraining', 12: 'curling', 13: 'cycling', 14: 'dance',
  16: 'elliptical', 17: 'equestrianSports', 18: 'fencing', 19: 'fishing',
  20: 'functionalStrengthTraining', 21: 'golf', 22: 'gymnastics', 23: 'handball',
  24: 'hiking', 25: 'hockey', 26: 'hunting', 27: 'lacrosse', 28: 'martialArts',
  29: 'mindAndBody', 31: 'paddleSports', 33: 'preparationAndRecovery',
  34: 'racquetball', 35: 'rowing', 36: 'rugby', 37: 'running', 38: 'sailing',
  39: 'skatingSports', 40: 'snowSports', 41: 'soccer', 42: 'softball',
  43: 'squash', 44: 'stairClimbing', 45: 'surfingSports', 46: 'swimming',
  47: 'tableTennis', 48: 'tennis', 49: 'trackAndField',
  50: 'traditionalStrengthTraining', 51: 'volleyball', 52: 'walking',
  53: 'waterFitness', 54: 'waterPolo', 55: 'waterSports', 56: 'wrestling',
  57: 'yoga', 58: 'barre', 59: 'coreTraining', 60: 'crossCountrySkiing',
  61: 'downhillSkiing', 62: 'flexibility', 63: 'highIntensityIntervalTraining',
  64: 'jumpRope', 65: 'kickboxing', 66: 'pilates', 67: 'snowboarding',
  68: 'stairs', 69: 'stepTraining', 72: 'taiChi', 73: 'mixedCardio',
  74: 'handCycling', 75: 'discSports', 76: 'fitnessGaming', 77: 'cardioDance',
  78: 'socialDance', 79: 'pickleball', 80: 'cooldown', 82: 'swimBikeRun',
  83: 'transition', 84: 'underwaterDiving', 3000: 'other',
};

export function resolveActivityTypeName(hkType: string | number): string {
  if (typeof hkType === 'number') {
    return HK_ACTIVITY_NAMES[hkType] ?? `unknown_${hkType}`;
  }
  return hkType;
}

export function mapHealthKitActivityType(hkType: string | number): string {
  const name = resolveActivityTypeName(hkType);
  return HEALTHKIT_TYPE_MAP[name] ?? name;
}

// ── Normalized workout representation ────────────────────────────────────────

export interface HealthKitWorkoutSummary {
  uuid: string;
  workoutActivityType: string;
  mappedActivityType: string;
  startDate: Date;
  endDate: Date;
  durationSeconds: number;
  distanceKm: number | null;
  totalEnergyBurnedKcal: number | null;
  sourceDevice: string | null;
  isIndoor: boolean;
  // Lap boundaries from HKWorkoutEvent (type=lap). Each entry is a (start, end) pair
  // in milliseconds since epoch. May be empty if the source watch didn't record laps.
  lapEvents: { startMs: number; endMs: number }[];
}

// ── Service (lazy-loaded to avoid import crash on Android/web/Expo Go) ───────

type HKModule = typeof import('@kingstinct/react-native-healthkit');
let _hk: HKModule | null = null;
let _hkUnavailable = false;

function getHK(): HKModule {
  if (!IS_IOS || _hkUnavailable) throw new Error('HealthKit not available');
  if (!_hk) {
    const orig = console.error;
    try {
      console.error = () => {};
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load: module is native-only and crashes on Android/web/Expo Go at import time
      _hk = require('@kingstinct/react-native-healthkit') as HKModule;
    } catch {
      _hkUnavailable = true;
      throw new Error('HealthKit not available (requires iOS development build)');
    } finally {
      console.error = orig;
    }
  }
  return _hk;
}

function extractSamples(result: unknown): any[] {
  return Array.isArray(result) ? result : (result as any).samples ?? [];
}

export type HealthKitStatus = 'available' | 'needs_dev_build' | 'not_supported';

export async function checkAvailability(): Promise<HealthKitStatus> {
  if (!IS_IOS) return 'not_supported';
  if (_hkUnavailable) return 'needs_dev_build';
  try {
    const hk = getHK();
    return hk.isHealthDataAvailable() ? 'available' : 'not_supported';
  } catch {
    return 'needs_dev_build';
  }
}

export async function isAvailable(): Promise<boolean> {
  return (await checkAvailability()) === 'available';
}

export async function requestPermissions(): Promise<boolean> {
  const hk = getHK();
  await hk.requestAuthorization({
    toRead: [
      'HKWorkoutTypeIdentifier',
      'HKQuantityTypeIdentifierHeartRate',
      'HKQuantityTypeIdentifierActiveEnergyBurned',
      'HKQuantityTypeIdentifierDistanceWalkingRunning',
      'HKQuantityTypeIdentifierDistanceCycling',
      'HKQuantityTypeIdentifierDistanceSwimming',
      'HKWorkoutRouteTypeIdentifier',
      // iOS 17+ cycling sensors. Older iOS ignores unknown identifiers in the array.
      'HKQuantityTypeIdentifierCyclingCadence',
      'HKQuantityTypeIdentifierCyclingPower',
    ],
  });
  return true;
}

function summarizeSample(s: any): HealthKitWorkoutSummary {
  const startDate = new Date(s.startDate);
  const endDate = new Date(s.endDate);
  const durationSeconds = s.duration?.quantity ?? (endDate.getTime() - startDate.getTime()) / 1000;
  const hkTypeName = resolveActivityTypeName(s.workoutActivityType as any);

  // WorkoutEventType.lap = 3
  const lapEvents: { startMs: number; endMs: number }[] = [];
  const events: any[] = s.events ?? [];
  for (const ev of events) {
    if (ev.type !== 3) continue;
    const eStart = new Date(ev.startDate).getTime();
    const eEnd = new Date(ev.endDate).getTime();
    lapEvents.push({ startMs: eStart, endMs: eEnd > eStart ? eEnd : eStart });
  }
  lapEvents.sort((a, b) => a.startMs - b.startMs);

  return {
    uuid: s.uuid,
    workoutActivityType: hkTypeName,
    mappedActivityType: mapHealthKitActivityType(hkTypeName),
    startDate,
    endDate,
    durationSeconds,
    distanceKm: s.totalDistance?.quantity ? s.totalDistance.quantity / 1000 : null,
    totalEnergyBurnedKcal: s.totalEnergyBurned?.quantity ?? null,
    sourceDevice: s.sourceRevision?.source?.name ?? null,
    isIndoor: s.metadataIndoorWorkout ?? false,
    lapEvents,
  };
}

export async function getRecentWorkouts(
  since: Date,
): Promise<HealthKitWorkoutSummary[]> {
  const hk = getHK();

  const result = await hk.queryWorkoutSamples({
    limit: 100,
    ascending: false,
    filter: {
      duration: { predicateOperator: 2 as any, durationInSeconds: 60 },
    },
  });

  const samples = extractSamples(result);
  const sinceMs = since.getTime();
  const summaries: HealthKitWorkoutSummary[] = [];

  for (const s of samples) {
    const summary = summarizeSample(s);
    if (summary.startDate.getTime() < sinceMs) continue;
    summaries.push(summary);
  }

  return summaries;
}

export async function getWorkoutByUUID(uuid: string): Promise<HealthKitWorkoutSummary | null> {
  const hk = getHK();
  const result = await hk.queryWorkoutSamples({
    limit: 1,
    filter: { uuid },
  });
  const samples = extractSamples(result);
  return samples.length > 0 ? summarizeSample(samples[0]) : null;
}

export async function getWorkoutHeartRate(
  startDate: Date,
  endDate: Date,
): Promise<HRReading[]> {
  const hk = getHK();

  const result = await hk.queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
    filter: {
      date: { startDate, endDate },
    },
    ascending: true,
    limit: 0,
  });

  const samples = extractSamples(result);

  return samples.map((s: any) => ({
    bpm: Math.round(s.quantity),
    timestamp: new Date(s.startDate).getTime(),
  }));
}

/**
 * Fetch cycling cadence (rpm) samples for a workout window. Only available on
 * iOS 17+; returns [] on older OS or if the identifier query throws.
 */
export async function getWorkoutCyclingCadence(
  startDate: Date,
  endDate: Date,
): Promise<CadenceReading[]> {
  try {
    const hk = getHK();
    const result = await hk.queryQuantitySamples(
      'HKQuantityTypeIdentifierCyclingCadence' as any,
      { filter: { date: { startDate, endDate } }, ascending: true, limit: 0 },
    );
    return extractSamples(result).map((s: any) => ({
      spm: Math.round(s.quantity),
      timestamp: new Date(s.startDate).getTime(),
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch cycling power (watts) samples for a workout window. iOS 17+ only.
 */
export async function getWorkoutCyclingPower(
  startDate: Date,
  endDate: Date,
): Promise<PowerReading[]> {
  try {
    const hk = getHK();
    const result = await hk.queryQuantitySamples(
      'HKQuantityTypeIdentifierCyclingPower' as any,
      { filter: { date: { startDate, endDate } }, ascending: true, limit: 0 },
    );
    return extractSamples(result).map((s: any) => ({
      watts: Math.round(s.quantity),
      timestamp: new Date(s.startDate).getTime(),
    }));
  } catch {
    return [];
  }
}

export async function getWorkoutRoute(
  workoutUUID: string,
): Promise<GPSPoint[]> {
  const hk = getHK();

  try {
    const workouts = await hk.queryWorkoutSamples({
      limit: 1,
      filter: { uuid: workoutUUID },
    });
    const workout = extractSamples(workouts)[0];
    if (!workout) return [];

    const routes = await (workout as any).getWorkoutRoutes?.();
    if (!routes || routes.length === 0) return [];

    const locations: GPSPoint[] = [];
    for (const route of routes) {
      const locs: any[] = route.locations ?? route;
      for (let i = 0; i < locs.length; i++) {
        const loc = locs[i];
        locations.push({
          lat: loc.latitude,
          lng: loc.longitude,
          altitude: loc.altitude ?? null,
          accuracy: loc.horizontalAccuracy ?? 10,
          speed: loc.speed >= 0 ? loc.speed : null,
          timestamp: new Date(loc.date).getTime(),
          distance_from_prev: 0,
        });
      }
    }

    for (let i = 1; i < locations.length; i++) {
      locations[i].distance_from_prev = haversineMetres(
        locations[i - 1].lat,
        locations[i - 1].lng,
        locations[i].lat,
        locations[i].lng,
      );
    }

    return locations;
  } catch {
    return [];
  }
}

// ── Build shared WorkoutFileParseResult ──────────────────────────────────────

/**
 * Construct Lap[] from HealthKit lap events + GPS points + HR readings.
 *
 * Some watches emit a lap event per lap with distinct startDate/endDate; others
 * just drop a marker at each lap boundary. We handle both: if events have a
 * non-zero duration we use them directly, otherwise we treat each timestamp as
 * a lap boundary and split between successive boundaries (with workout-start
 * as the implicit first boundary).
 */
function buildLapsFromEvents(
  lapEvents: { startMs: number; endMs: number }[],
  workoutStartMs: number,
  workoutEndMs: number,
  gpsPoints: GPSPoint[],
  hrReadings: HRReading[],
): Lap[] {
  if (lapEvents.length === 0) return [];

  // Detect whether events carry real intervals or just boundary markers
  const hasIntervals = lapEvents.some((e) => e.endMs - e.startMs > 1000);
  const intervals: { startMs: number; endMs: number }[] = [];
  if (hasIntervals) {
    for (const e of lapEvents) {
      if (e.endMs - e.startMs > 1000) intervals.push({ startMs: e.startMs, endMs: e.endMs });
    }
  } else {
    let prev = workoutStartMs;
    for (const e of lapEvents) {
      if (e.startMs > prev) intervals.push({ startMs: prev, endMs: e.startMs });
      prev = e.startMs;
    }
    if (workoutEndMs > prev) intervals.push({ startMs: prev, endMs: workoutEndMs });
  }

  return intervals.map((iv, idx) => {
    // Exclusive on start so a boundary point doesn't double-count its segment
    // into the previous lap.
    const pointsInLap = gpsPoints.filter((p) => p.timestamp > iv.startMs && p.timestamp <= iv.endMs);
    const distanceM = pointsInLap.reduce((s, p) => s + p.distance_from_prev, 0);
    const durationSec = (iv.endMs - iv.startMs) / 1000;
    const speed = distanceM > 0 && durationSec > 0 ? (distanceM / 1000) / (durationSec / 3600) : 0;
    const pace = distanceM > 0 && durationSec > 0 ? (durationSec / distanceM) * 1000 : 0;
    const hrInLap = hrReadings.filter((r) => r.timestamp >= iv.startMs && r.timestamp <= iv.endMs);
    const avgHr = hrInLap.length > 0
      ? Math.round(hrInLap.reduce((s, r) => s + r.bpm, 0) / hrInLap.length)
      : undefined;
    return {
      lap_number: idx + 1,
      start_time: iv.startMs,
      end_time: iv.endMs,
      distance_m: distanceM,
      duration_sec: durationSec,
      avg_pace_sec_per_km: pace,
      avg_speed_kph: speed,
      avg_hr: avgHr,
      elevation_gain_m: computeElevationGain(pointsInLap),
    };
  });
}

export function buildHealthKitParseResult(
  summary: HealthKitWorkoutSummary,
  hrReadings: HRReading[],
  gpsPoints: GPSPoint[],
  cadenceReadings: CadenceReading[] = [],
  powerReadings: PowerReading[] = [],
): WorkoutFileParseResult {
  const totalDistanceM = gpsPoints.length > 0
    ? gpsPoints.reduce((s, p) => s + p.distance_from_prev, 0)
    : (summary.distanceKm ?? 0) * 1000;

  const laps = buildLapsFromEvents(
    summary.lapEvents,
    summary.startDate.getTime(),
    summary.endDate.getTime(),
    gpsPoints,
    hrReadings,
  );

  return {
    name: 'Apple Health Workout',
    type: summary.workoutActivityType,
    sourceFormat: 'apple_health',
    points: gpsPoints,
    hrReadings,
    cadenceReadings,
    powerReadings,
    laps,
    startTime: summary.startDate,
    endTime: summary.endDate,
    totalDistanceM,
    durationSec: summary.durationSeconds,
    elevationGainM: computeElevationGain(gpsPoints),
    caloriesKcal: summary.totalEnergyBurnedKcal ?? undefined,
    sourceDevice: summary.sourceDevice ?? undefined,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
