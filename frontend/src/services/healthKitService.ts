import { LogBox, Platform } from 'react-native';
import type { SaveWorkoutInput } from './api';
import type { GPSPoint, GPSRouteData, HRData, HRReading } from '../types/gps';

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
  traditionalStrengthTraining: 'strength',
  functionalStrengthTraining: 'strength',
  walking: 'walk',
  yoga: 'yoga',
  hiking: 'trail_run',
  coreTraining: 'strength',
  flexibility: 'mobility',
  highIntensityIntervalTraining: 'interval',
  elliptical: 'indoor_run',
  crossTraining: 'strength',
  pilates: 'mobility',
  dance: 'mobility',
  rowing: 'rowing',
  stairClimbing: 'walk',
  mixedCardio: 'interval',
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
    ],
  });
  return true;
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
    const startDate = new Date(s.startDate);
    if (startDate.getTime() < sinceMs) continue;

    const endDate = new Date(s.endDate);
    const durationSeconds = s.duration?.quantity ?? (endDate.getTime() - startDate.getTime()) / 1000;

    const hkTypeName = resolveActivityTypeName(s.workoutActivityType as any);

    summaries.push({
      uuid: s.uuid,
      workoutActivityType: hkTypeName,
      mappedActivityType: mapHealthKitActivityType(hkTypeName),
      startDate,
      endDate,
      durationSeconds,
      distanceKm: s.totalDistance?.quantity ? s.totalDistance.quantity / 1000 : null,
      totalEnergyBurnedKcal: s.totalEnergyBurned?.quantity ?? null,
      sourceDevice: (s as any).sourceRevision?.source?.name ?? null,
      isIndoor: (s as any).metadataIndoorWorkout ?? false,
    });
  }

  return summaries;
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

// ── Build SaveWorkoutInput ───────────────────────────────────────────────────

export function buildSaveWorkoutInput(
  summary: HealthKitWorkoutSummary,
  hrReadings: HRReading[],
  gpsPoints: GPSPoint[],
  scheduledActivityId?: string,
): SaveWorkoutInput {
  const hasRoute = gpsPoints.length > 0;
  const hasHR = hrReadings.length > 0;

  const avgHR = hasHR
    ? Math.round(hrReadings.reduce((s, r) => s + r.bpm, 0) / hrReadings.length)
    : undefined;
  const maxHR = hasHR ? Math.max(...hrReadings.map((r) => r.bpm)) : undefined;

  const recordedData: Record<string, any> = {
    source_name: 'apple_health',
    source_device: summary.sourceDevice,
  };
  if (summary.distanceKm != null) recordedData.distance_km = round2(summary.distanceKm);
  if (summary.totalEnergyBurnedKcal != null) recordedData.calories = Math.round(summary.totalEnergyBurnedKcal);
  if (avgHR != null) recordedData.avg_hr = avgHR;
  if (maxHR != null) recordedData.max_hr = maxHR;

  const input: SaveWorkoutInput = {
    activity_type: summary.mappedActivityType,
    source: 'apple_health',
    started_at: summary.startDate.toISOString(),
    finished_at: summary.endDate.toISOString(),
    recorded_data: recordedData,
  };

  if (scheduledActivityId) {
    input.scheduled_activity_id = scheduledActivityId;
  }

  if (hasRoute) {
    const totalDistanceM = gpsPoints.reduce((s, p) => s + p.distance_from_prev, 0);
    const distKm = totalDistanceM / 1000;
    const route: GPSRouteData = {
      sport: summary.mappedActivityType,
      distance_km: round2(distKm || (summary.distanceKm ?? 0)),
      duration_sec: summary.durationSeconds,
      avg_pace_sec_per_km: distKm > 0 ? round2(summary.durationSeconds / distKm) : 0,
      avg_speed_kph: summary.durationSeconds > 0 ? round2((distKm / summary.durationSeconds) * 3600) : 0,
      elevation_gain_m: computeElevationGain(gpsPoints),
      avg_hr: avgHR,
      max_hr: maxHR,
      points: gpsPoints,
      laps: [],
      auto_paused_duration_sec: 0,
    };
    input.gps_route = route as any;
  }

  if (hasHR) {
    const hrData: HRData = {
      readings: hrReadings,
      device_name: summary.sourceDevice ?? undefined,
    };
    input.heart_rate_data = hrData as any;
  }

  return input;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeElevationGain(points: GPSPoint[]): number {
  let gain = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].altitude;
    const curr = points[i].altitude;
    if (prev != null && curr != null && curr > prev) {
      gain += curr - prev;
    }
  }
  return round2(gain);
}

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
