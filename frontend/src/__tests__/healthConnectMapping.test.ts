jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));
jest.mock('react-native-health-connect', () => ({}), { virtual: true });

// eslint-disable-next-line import/first
import {
  mapHealthConnectExerciseType,
  resolveExerciseTypeName,
  buildHealthConnectParseResult,
} from '../services/healthConnectService';
// eslint-disable-next-line import/first
import type { HealthConnectWorkoutSummary } from '../services/healthConnectService';
// eslint-disable-next-line import/first
import { buildFileSavePayload } from '../services/workoutFileParser';
// eslint-disable-next-line import/first
import type { GPSPoint, HRReading } from '../types/gps';

// ── resolveExerciseTypeName ──────────────────────────────────────────────────

describe('resolveExerciseTypeName', () => {
  test('resolves Health Connect numeric ExerciseType enum to snake_case names', () => {
    expect(resolveExerciseTypeName(56)).toBe('running');
    expect(resolveExerciseTypeName(57)).toBe('running_treadmill');
    expect(resolveExerciseTypeName(8)).toBe('biking');
    expect(resolveExerciseTypeName(74)).toBe('swimming_pool');
    expect(resolveExerciseTypeName(73)).toBe('swimming_open_water');
    expect(resolveExerciseTypeName(70)).toBe('strength_training');
    expect(resolveExerciseTypeName(83)).toBe('yoga');
    expect(resolveExerciseTypeName(0)).toBe('other_workout');
  });

  test('falls back to exercise_<n> for unknown values', () => {
    expect(resolveExerciseTypeName(9999)).toBe('exercise_9999');
  });
});

// ── mapHealthConnectExerciseType ─────────────────────────────────────────────

describe('mapHealthConnectExerciseType', () => {
  const cases: [number, string][] = [
    [56, 'run'],                  // RUNNING
    [57, 'indoor_run'],           // RUNNING_TREADMILL
    [8, 'cycling'],               // BIKING
    [9, 'indoor_cycling'],        // BIKING_STATIONARY
    [74, 'swim'],                 // SWIMMING_POOL
    [73, 'open_water_swim'],      // SWIMMING_OPEN_WATER
    [79, 'walk'],                 // WALKING
    [37, 'walk'],                 // HIKING
    [70, 'strength_training'],    // STRENGTH_TRAINING
    [81, 'strength_training'],    // WEIGHTLIFTING
    [13, 'strength_training'],    // CALISTHENICS
    [36, 'cross_training'],       // HIGH_INTENSITY_INTERVAL_TRAINING
    [83, 'yoga'],                 // YOGA
    [48, 'mobility'],             // PILATES
    [71, 'mobility'],             // STRETCHING
    [25, 'indoor_run'],           // ELLIPTICAL
    [53, 'cross_training'],       // ROWING
  ];

  test.each(cases)('maps exerciseType %i to "%s"', (n, expected) => {
    expect(mapHealthConnectExerciseType(n)).toBe(expected);
  });

  test('falls back to outdoor_activity for unmapped types', () => {
    expect(mapHealthConnectExerciseType(0)).toBe('outdoor_activity');
    expect(mapHealthConnectExerciseType(32)).toBe('outdoor_activity'); // GOLF
    expect(mapHealthConnectExerciseType(9999)).toBe('outdoor_activity');
  });
});

// ── buildHealthConnectParseResult ────────────────────────────────────────────

function makeSummary(overrides: Partial<HealthConnectWorkoutSummary> = {}): HealthConnectWorkoutSummary {
  return {
    recordId: 'hc-record-uuid-123',
    exerciseType: 56,
    exerciseTypeName: 'running',
    mappedActivityType: 'run',
    startDate: new Date('2026-03-01T08:00:00Z'),
    endDate: new Date('2026-03-01T08:30:00Z'),
    durationSeconds: 1800,
    distanceKm: 5.0,
    totalEnergyBurnedKcal: 350,
    sourceDevice: 'com.fitbit.FitbitMobile',
    title: null,
    ...overrides,
  };
}

describe('buildHealthConnectParseResult', () => {
  test('basic workout without HR or GPS uses summary distance', () => {
    const result = buildHealthConnectParseResult(makeSummary(), [], []);

    expect(result.sourceFormat).toBe('health_connect');
    expect(result.type).toBe('running');
    expect(result.startTime).toEqual(new Date('2026-03-01T08:00:00Z'));
    expect(result.endTime).toEqual(new Date('2026-03-01T08:30:00Z'));
    expect(result.durationSec).toBe(1800);
    expect(result.totalDistanceM).toBe(5000);
    expect(result.points).toEqual([]);
    expect(result.hrReadings).toEqual([]);
    expect(result.caloriesKcal).toBe(350);
    expect(result.sourceDevice).toBe('com.fitbit.FitbitMobile');
  });

  test('uses session title when provided, otherwise default name', () => {
    expect(buildHealthConnectParseResult(makeSummary({ title: 'Morning Run' }), [], []).name).toBe('Morning Run');
    expect(buildHealthConnectParseResult(makeSummary({ title: null }), [], []).name).toBe('Health Connect Workout');
  });

  test('GPS points override summary distance', () => {
    const points: GPSPoint[] = [
      { lat: 42.0, lng: -71.0, altitude: 10, accuracy: 5, speed: 3.0, timestamp: 1000, distance_from_prev: 0 },
      { lat: 42.001, lng: -71.0, altitude: 15, accuracy: 5, speed: 3.0, timestamp: 2000, distance_from_prev: 111 },
      { lat: 42.002, lng: -71.0, altitude: 12, accuracy: 5, speed: 3.0, timestamp: 3000, distance_from_prev: 111 },
    ];
    const result = buildHealthConnectParseResult(makeSummary(), [], points);

    expect(result.totalDistanceM).toBe(222);
    expect(result.points).toHaveLength(3);
  });

  test('handles null distance and calories gracefully', () => {
    const result = buildHealthConnectParseResult(
      makeSummary({ distanceKm: null, totalEnergyBurnedKcal: null }),
      [], [],
    );
    expect(result.totalDistanceM).toBe(0);
    expect(result.caloriesKcal).toBeUndefined();
  });
});

// ── End-to-end: parse result feeds buildFileSavePayload ──────────────────────

describe('buildHealthConnectParseResult + buildFileSavePayload', () => {
  test('produces save payload with health_connect source and HR/GPS data', () => {
    const hr: HRReading[] = [
      { bpm: 140, timestamp: 1000 },
      { bpm: 160, timestamp: 2000 },
      { bpm: 150, timestamp: 3000 },
    ];
    const points: GPSPoint[] = [
      { lat: 42.0, lng: -71.0, altitude: 10, accuracy: 5, speed: 3.0, timestamp: 1000, distance_from_prev: 0 },
      { lat: 42.001, lng: -71.0, altitude: 15, accuracy: 5, speed: 3.0, timestamp: 2000, distance_from_prev: 111 },
    ];
    const result = buildHealthConnectParseResult(makeSummary(), hr, points);
    const payload = buildFileSavePayload(result, 'run');

    expect(payload.source).toBe('health_connect');
    expect(payload.activity_type).toBe('run');
    expect(payload.started_at).toBe('2026-03-01T08:00:00.000Z');
    expect(payload.finished_at).toBe('2026-03-01T08:30:00.000Z');
    expect(payload.recorded_data.calories).toBe(350);
    expect(payload.recorded_data.source_device).toBe('com.fitbit.FitbitMobile');
    expect(payload.recorded_data.avg_hr).toBe(150);
    expect(payload.recorded_data.max_hr).toBe(160);
    expect((payload.gps_route as any).points).toHaveLength(2);
    expect((payload.heart_rate_data as any).readings).toHaveLength(3);
  });

  test('strength workout produces empty gps payload', () => {
    const summary = makeSummary({
      exerciseType: 70,
      exerciseTypeName: 'strength_training',
      mappedActivityType: 'strength_training',
      distanceKm: null,
    });
    const result = buildHealthConnectParseResult(summary, [], []);
    const payload = buildFileSavePayload(result, 'strength_training');

    expect(payload.activity_type).toBe('strength_training');
    expect(payload.source).toBe('health_connect');
    expect((payload.gps_route as any).points).toEqual([]);
  });
});
