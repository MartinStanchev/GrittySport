jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));
jest.mock('@kingstinct/react-native-healthkit', () => ({}));

// eslint-disable-next-line import/first
import {
  mapHealthKitActivityType,
  resolveActivityTypeName,
  buildHealthKitParseResult,
} from '../services/healthKitService';
// eslint-disable-next-line import/first
import type { HealthKitWorkoutSummary } from '../services/healthKitService';
// eslint-disable-next-line import/first
import { buildFileSavePayload } from '../services/workoutFileParser';
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

// ── buildHealthKitParseResult ────────────────────────────────────────────────

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

describe('buildHealthKitParseResult', () => {
  test('basic workout without HR or GPS uses summary distance', () => {
    const result = buildHealthKitParseResult(makeSummary(), [], []);

    expect(result.sourceFormat).toBe('apple_health');
    expect(result.type).toBe('running');
    expect(result.startTime).toEqual(new Date('2026-03-01T08:00:00Z'));
    expect(result.endTime).toEqual(new Date('2026-03-01T08:30:00Z'));
    expect(result.durationSec).toBe(1800);
    expect(result.totalDistanceM).toBe(5000);
    expect(result.points).toEqual([]);
    expect(result.hrReadings).toEqual([]);
    expect(result.caloriesKcal).toBe(350);
    expect(result.sourceDevice).toBe('Apple Watch');
  });

  test('GPS points override summary distance', () => {
    const points: GPSPoint[] = [
      { lat: 42.0, lng: -71.0, altitude: 10, accuracy: 5, speed: 3.0, timestamp: 1000, distance_from_prev: 0 },
      { lat: 42.001, lng: -71.0, altitude: 15, accuracy: 5, speed: 3.0, timestamp: 2000, distance_from_prev: 111 },
      { lat: 42.002, lng: -71.0, altitude: 12, accuracy: 5, speed: 3.0, timestamp: 3000, distance_from_prev: 111 },
    ];
    const result = buildHealthKitParseResult(makeSummary(), [], points);

    expect(result.totalDistanceM).toBe(222);
    expect(result.points).toHaveLength(3);
  });

  test('handles null distance and calories gracefully', () => {
    const summary = makeSummary({ distanceKm: null, totalEnergyBurnedKcal: null });
    const result = buildHealthKitParseResult(summary, [], []);

    expect(result.totalDistanceM).toBe(0);
    expect(result.caloriesKcal).toBeUndefined();
  });
});

// ── End-to-end: parse result feeds buildFileSavePayload ──────────────────────

describe('buildHealthKitParseResult + buildFileSavePayload', () => {
  test('produces save payload with apple_health source and HR/GPS data', () => {
    const summary = makeSummary();
    const hr: HRReading[] = [
      { bpm: 140, timestamp: 1000 },
      { bpm: 160, timestamp: 2000 },
      { bpm: 150, timestamp: 3000 },
    ];
    const points: GPSPoint[] = [
      { lat: 42.0, lng: -71.0, altitude: 10, accuracy: 5, speed: 3.0, timestamp: 1000, distance_from_prev: 0 },
      { lat: 42.001, lng: -71.0, altitude: 15, accuracy: 5, speed: 3.0, timestamp: 2000, distance_from_prev: 111 },
    ];
    const result = buildHealthKitParseResult(summary, hr, points);

    const payload = buildFileSavePayload(result, 'run');

    expect(payload.source).toBe('apple_health');
    expect(payload.activity_type).toBe('run');
    expect(payload.started_at).toBe('2026-03-01T08:00:00.000Z');
    expect(payload.finished_at).toBe('2026-03-01T08:30:00.000Z');
    expect(payload.recorded_data.calories).toBe(350);
    expect(payload.recorded_data.source_device).toBe('Apple Watch');
    expect(payload.recorded_data.avg_hr).toBe(150);
    expect(payload.recorded_data.max_hr).toBe(160);
    expect(payload.gps_route).toBeDefined();
    expect((payload.gps_route as any).points).toHaveLength(2);
    expect(payload.heart_rate_data).toBeDefined();
    expect((payload.heart_rate_data as any).readings).toHaveLength(3);
  });

  test('indoor strength workout produces empty gps payload', () => {
    const summary = makeSummary({
      workoutActivityType: 'traditionalStrengthTraining',
      mappedActivityType: 'strength_training',
      distanceKm: null,
      isIndoor: true,
    });
    const result = buildHealthKitParseResult(summary, [], []);
    const payload = buildFileSavePayload(result, 'strength_training');

    expect(payload.activity_type).toBe('strength_training');
    expect(payload.source).toBe('apple_health');
    expect((payload.gps_route as any).points).toEqual([]);
  });

  test('passes scheduled_activity_id through', () => {
    const result = buildHealthKitParseResult(makeSummary(), [], []);
    const payload = buildFileSavePayload(result, 'run', undefined, 'activity-uuid-456');

    expect(payload.scheduled_activity_id).toBe('activity-uuid-456');
  });
});
