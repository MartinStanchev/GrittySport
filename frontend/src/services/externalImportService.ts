import { Platform } from 'react-native';
import * as healthKit from './healthKitService';
import * as healthConnect from './healthConnectService';
import { markImported } from './importedWorkoutsStore';
import type { WorkoutFileParseResult } from './workoutFileParser';

// Platform-aware façade over Apple Health (iOS) and Health Connect (Android).
// ImportScreen / ImportPreviewScreen go through this so they stay platform-blind.

export type ExternalSource = 'apple_health' | 'health_connect';

export type ExternalImportStatus =
  | 'available'
  | 'needs_install'
  | 'needs_update'
  | 'needs_dev_build'
  | 'not_supported';

export interface ExternalWorkoutSummary {
  externalId: string;
  source: ExternalSource;
  mappedActivityType: string;
  startDate: Date;
  endDate: Date;
  durationSeconds: number;
  distanceKm: number | null;
  totalEnergyBurnedKcal: number | null;
  sourceDevice: string | null;
}

export function getCurrentSource(): ExternalSource | null {
  if (Platform.OS === 'ios') return 'apple_health';
  if (Platform.OS === 'android') return 'health_connect';
  return null;
}

export function getSourceLabel(source: ExternalSource | null): string {
  if (source === 'apple_health') return 'Apple Health';
  if (source === 'health_connect') return 'Health Connect';
  return '';
}

export const ENABLED_FLAG_KEY: Record<ExternalSource, string> = {
  apple_health: 'apple_health_enabled',
  health_connect: 'health_connect_enabled',
};

export async function checkAvailability(): Promise<ExternalImportStatus> {
  const source = getCurrentSource();
  if (source === 'apple_health') return healthKit.checkAvailability();
  if (source === 'health_connect') return healthConnect.checkAvailability();
  return 'not_supported';
}

export async function isAvailable(): Promise<boolean> {
  return (await checkAvailability()) === 'available';
}

export async function requestPermissions(): Promise<boolean> {
  const source = getCurrentSource();
  if (source === 'apple_health') return healthKit.requestPermissions();
  if (source === 'health_connect') return healthConnect.requestPermissions();
  return false;
}

export function openProviderSettings(): void {
  if (getCurrentSource() === 'health_connect') {
    healthConnect.openSettings();
  }
}

function toExternalSummary(
  source: ExternalSource,
  externalId: string,
  w: {
    mappedActivityType: string;
    startDate: Date;
    endDate: Date;
    durationSeconds: number;
    distanceKm: number | null;
    totalEnergyBurnedKcal: number | null;
    sourceDevice: string | null;
  },
): ExternalWorkoutSummary {
  return {
    externalId,
    source,
    mappedActivityType: w.mappedActivityType,
    startDate: w.startDate,
    endDate: w.endDate,
    durationSeconds: w.durationSeconds,
    distanceKm: w.distanceKm,
    totalEnergyBurnedKcal: w.totalEnergyBurnedKcal,
    sourceDevice: w.sourceDevice,
  };
}

export async function getRecentWorkouts(
  since: Date,
): Promise<ExternalWorkoutSummary[]> {
  const source = getCurrentSource();
  if (source === 'apple_health') {
    const workouts = await healthKit.getRecentWorkouts(since);
    return workouts.map((w) => toExternalSummary('apple_health', w.uuid, w));
  }
  if (source === 'health_connect') {
    const workouts = await healthConnect.getRecentWorkouts(since);
    return workouts.map((w) => toExternalSummary('health_connect', w.recordId, w));
  }
  return [];
}

export async function loadWorkoutParseResult(
  externalId: string,
): Promise<WorkoutFileParseResult> {
  const source = getCurrentSource();
  if (source === 'apple_health') {
    const summary = await healthKit.getWorkoutByUUID(externalId);
    if (!summary) throw new Error('Workout not found in Apple Health.');
    const [hr, pts] = await Promise.all([
      healthKit.getWorkoutHeartRate(summary.startDate, summary.endDate),
      summary.isIndoor ? Promise.resolve([]) : healthKit.getWorkoutRoute(summary.uuid),
    ]);
    return healthKit.buildHealthKitParseResult(summary, hr, pts);
  }
  if (source === 'health_connect') {
    const summary = await healthConnect.getWorkoutById(externalId);
    if (!summary) throw new Error('Workout not found in Health Connect.');
    const [hr, pts] = await Promise.all([
      healthConnect.getWorkoutHeartRate(summary.startDate, summary.endDate),
      healthConnect.getWorkoutRoute(externalId),
    ]);
    return healthConnect.buildHealthConnectParseResult(summary, hr, pts);
  }
  throw new Error('Health import not supported on this platform.');
}

export async function markWorkoutImported(
  externalId: string,
  backendWorkoutId: string,
): Promise<void> {
  const source = getCurrentSource();
  if (!source) return;
  await markImported(source, externalId, backendWorkoutId);
}
