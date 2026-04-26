jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));
jest.mock('@kingstinct/react-native-healthkit', () => ({}));

// eslint-disable-next-line import/first
import {
  mapHealthKitActivityType,
  resolveActivityTypeName,
  buildSaveWorkoutInput,
} from '../services/healthKitService';
// eslint-disable-next-line import/first
import type { HealthKitWorkoutSummary } from '../services/healthKitService';
// eslint-disable-next-line import/first
import type { GPSPoint, HRReading } from '../types/gps';

// ── resolveActivityTypeName ──────────────────────────────────────────────────

describe('resolveActivityTypeName', () => {
  test('resolves numeric enum values to string names', () => {
    expect(resolveActivityTypeName(37)).toBe('running');
    expect(resolveActivityTypeName(13)).toBe('cycling');
    expect(resolveActivityTypeName(46)).toBe('swimming');
    expect(resolveActivityTypeName(50)).toBe('traditionalStrengthTraining');
    expect(resolveActivityTypeName(52)).toBe('walking');
    expect(resolveActivityTypeName(57)).toBe('yoga');
    expect(resolveActivityTypeName(3000)).toBe('other');
  });

  test('passes through string names unchanged', () => {
    expect(resolveActivityTypeName('running')).toBe('running');
    expect(resolveActivityTypeName('cycling')).toBe('cycling');
  });

  test('handles unknown numeric values', () => {
    expect(resolveActivityTypeName(9999)).toBe('unknown_9999');
  });
});

// ── mapHealthKitActivityType ─────────────────────────────────────────────────

describe('mapHealthKitActivityType', () => {
  const stringCases: [string, string][] = [
    ['running', 'run'],
    ['cycling', 'cycling'],
    ['swimming', 'swim'],
    ['traditionalStrengthTraining', 'strength_training'],
    ['functionalStrengthTraining', 'strength_training'],
    ['walking', 'walk'],
    ['yoga', 'yoga'],
    ['hiking', 'run'],
    ['coreTraining', 'strength_training'],
    ['flexibility', 'mobility'],
    ['highIntensityIntervalTraining', 'run'],
    ['elliptical', 'indoor_run'],
    ['crossTraining', 'cross_training'],
    ['pilates', 'mobility'],
  ];

  test.each(stringCases)('maps string "%s" to "%s"', (hkType, expected) => {
    expect(mapHealthKitActivityType(hkType)).toBe(expected);
  });

  test('maps numeric enum values through the resolver', () => {
    expect(mapHealthKitActivityType(37)).toBe('run');
    expect(mapHealthKitActivityType(13)).toBe('cycling');
    expect(mapHealthKitActivityType(46)).toBe('swim');
    expect(mapHealthKitActivityType(52)).toBe('walk');
  });

  test('returns original type if no mapping exists', () => {
    expect(mapHealthKitActivityType('archery')).toBe('archery');
    expect(mapHealthKitActivityType('tableTennis')).toBe('tableTennis');
  });
});

// ── buildSaveWorkoutInput ────────────────────────────────────────────────────

function makeSummary(overrides: Partial<HealthKitWorkoutSummary> = {}): HealthKitWorkoutSummary {
  return {
    uuid: 'test-uuid-123',
    workoutActivityType: 'running',
    mappedActivityType: 'run',
    startDate: new Date('2026-03-01T08:00:00Z'),
    endDate: new Date('2026-03-01T08:30:00Z'),
    durationSeconds: 1800,
    distanceKm: 5.0,
    totalEnergyBurnedKcal: 350,
    sourceDevice: 'Apple Watch',
    isIndoor: false,
    ...overrides,
  };
}

describe('buildSaveWorkoutInput', () => {
  test('basic workout without HR or GPS', () => {
    const summary = makeSummary();
    const input = buildSaveWorkoutInput(summary, [], []);

    expect(input.source).toBe('apple_health');
    expect(input.activity_type).toBe('run');
    expect(input.started_at).toBe('2026-03-01T08:00:00.000Z');
    expect(input.finished_at).toBe('2026-03-01T08:30:00.000Z');
    expect(input.recorded_data.distance_km).toBe(5);
    expect(input.recorded_data.calories).toBe(350);
    expect(input.recorded_data.source_name).toBe('apple_health');
    expect(input.recorded_data.source_device).toBe('Apple Watch');
    expect(input.gps_route).toBeUndefined();
    expect(input.heart_rate_data).toBeUndefined();
  });

  test('workout with HR readings populates heart_rate_data and recorded_data avg/max', () => {
    const summary = makeSummary();
    const hr: HRReading[] = [
      { bpm: 140, timestamp: 1000 },
      { bpm: 160, timestamp: 2000 },
      { bpm: 150, timestamp: 3000 },
    ];
    const input = buildSaveWorkoutInput(summary, hr, []);

    expect(input.heart_rate_data).toBeDefined();
    expect((input.heart_rate_data as any).readings).toHaveLength(3);
    expect((input.heart_rate_data as any).device_name).toBe('Apple Watch');
    expect(input.recorded_data.avg_hr).toBe(150);
    expect(input.recorded_data.max_hr).toBe(160);
  });

  test('workout with GPS route populates gps_route', () => {
    const summary = makeSummary({ distanceKm: 5.0 });
    const points: GPSPoint[] = [
      { lat: 42.0, lng: -71.0, altitude: 10, accuracy: 5, speed: 3.0, timestamp: 1000, distance_from_prev: 0 },
      { lat: 42.001, lng: -71.0, altitude: 15, accuracy: 5, speed: 3.0, timestamp: 2000, distance_from_prev: 111 },
      { lat: 42.002, lng: -71.0, altitude: 12, accuracy: 5, speed: 3.0, timestamp: 3000, distance_from_prev: 111 },
    ];
    const input = buildSaveWorkoutInput(summary, [], points);

    expect(input.gps_route).toBeDefined();
    const route = input.gps_route as any;
    expect(route.sport).toBe('run');
    expect(route.points).toHaveLength(3);
    expect(route.elevation_gain_m).toBe(5);
    expect(route.duration_sec).toBe(1800);
    expect(route.laps).toEqual([]);
  });

  test('links to scheduled activity when provided', () => {
    const summary = makeSummary();
    const input = buildSaveWorkoutInput(summary, [], [], 'activity-uuid-456');

    expect(input.scheduled_activity_id).toBe('activity-uuid-456');
  });

  test('no scheduled_activity_id when not provided', () => {
    const input = buildSaveWorkoutInput(makeSummary(), [], []);
    expect(input.scheduled_activity_id).toBeUndefined();
  });

  test('handles null distance and calories gracefully', () => {
    const summary = makeSummary({ distanceKm: null, totalEnergyBurnedKcal: null });
    const input = buildSaveWorkoutInput(summary, [], []);

    expect(input.recorded_data.distance_km).toBeUndefined();
    expect(input.recorded_data.calories).toBeUndefined();
  });

  test('indoor workout maps correctly', () => {
    const summary = makeSummary({
      workoutActivityType: 'traditionalStrengthTraining',
      mappedActivityType: 'strength_training',
      distanceKm: null,
      isIndoor: true,
    });
    const input = buildSaveWorkoutInput(summary, [], []);

    expect(input.activity_type).toBe('strength_training');
    expect(input.gps_route).toBeUndefined();
  });
});
