import {
  detectActivityType,
  buildFileSavePayload,
  emptyParseResult,
} from '../services/workoutFileParser';
import type { WorkoutFileParseResult } from '../services/workoutFileParser';

describe('emptyParseResult', () => {
  it('returns a valid empty result with defaults', () => {
    const result = emptyParseResult();
    expect(result.name).toBe('Imported Workout');
    expect(result.sourceFormat).toBe('gpx');
    expect(result.points).toHaveLength(0);
    expect(result.hrReadings).toHaveLength(0);
    expect(result.cadenceReadings).toHaveLength(0);
    expect(result.powerReadings).toHaveLength(0);
    expect(result.laps).toHaveLength(0);
  });

  it('accepts custom values', () => {
    const result = emptyParseResult('Test', 'run', 'tcx');
    expect(result.name).toBe('Test');
    expect(result.type).toBe('run');
    expect(result.sourceFormat).toBe('tcx');
  });
});

describe('detectActivityType', () => {
  function makeResult(overrides: Partial<WorkoutFileParseResult> = {}): WorkoutFileParseResult {
    return {
      ...emptyParseResult(),
      ...overrides,
    };
  }

  it('maps known types', () => {
    expect(detectActivityType(makeResult({ type: 'running' }))).toBe('run');
    expect(detectActivityType(makeResult({ type: 'cycling' }))).toBe('cycling');
    expect(detectActivityType(makeResult({ type: 'swimming' }))).toBe('swim');
    expect(detectActivityType(makeResult({ type: 'hiking' }))).toBe('walk');
  });

  it('uses speed heuristic for unknown types', () => {
    // 10 km/h → run
    expect(detectActivityType(makeResult({
      totalDistanceM: 5000,
      durationSec: 1800,
    }))).toBe('run');
  });

  it('defaults to run', () => {
    expect(detectActivityType(makeResult())).toBe('run');
  });
});

describe('buildFileSavePayload', () => {
  it('builds payload with correct source format', () => {
    const result: WorkoutFileParseResult = {
      ...emptyParseResult('Test', 'run', 'tcx'),
      startTime: new Date('2024-06-01T08:00:00Z'),
      endTime: new Date('2024-06-01T09:00:00Z'),
      totalDistanceM: 5000,
      durationSec: 3600,
    };

    const payload = buildFileSavePayload(result, 'run', 'notes', 'act-1');
    expect(payload.source).toBe('tcx');
    expect(payload.activity_type).toBe('run');
    expect(payload.notes).toBe('notes');
    expect(payload.scheduled_activity_id).toBe('act-1');
  });

  it('works with FIT source', () => {
    const result = emptyParseResult('Test', 'cycling', 'fit');
    result.startTime = new Date('2024-06-01T08:00:00Z');
    result.endTime = new Date('2024-06-01T09:00:00Z');

    const payload = buildFileSavePayload(result, 'cycling');
    expect(payload.source).toBe('fit');
  });

  it('works with CSV source', () => {
    const result = emptyParseResult('Test', '', 'csv');
    result.startTime = new Date('2024-06-01T08:00:00Z');

    const payload = buildFileSavePayload(result, 'run');
    expect(payload.source).toBe('csv');
  });

  it('omits notes when empty', () => {
    const result = emptyParseResult();
    result.startTime = new Date();
    const payload = buildFileSavePayload(result, 'run', '  ');
    expect(payload.notes).toBeUndefined();
  });
});
