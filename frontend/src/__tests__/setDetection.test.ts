import {
  RISE_THRESHOLD_BPM,
  PEAK_HOLD_MIN_SEC,
  RECOVERY_DROP_BPM,
  RECOVERY_CONFIRM_SEC,
  MIN_TIME_BETWEEN_DETECTIONS_SEC,
  MIN_READINGS_FOR_BASELINE,
  SESSION_LIGHTWORK_CHECK_SEC,
  initialDetectionState,
  stepDetection,
  findNextUnfilledSet,
  type DetectionState,
} from '../utils/setDetection';
import type { HRReading } from '../types/gps';
import type { ExerciseLog } from '../contexts/WorkoutContext';

// ─── Test helpers ────────────────────────────────────────────────────────────

function constSeq(bpm: number, count: number, startMs: number, stepMs = 1000): HRReading[] {
  return Array.from({ length: count }, (_, i) => ({ bpm, timestamp: startMs + i * stepMs }));
}

function rampSeq(from: number, to: number, count: number, startMs: number, stepMs = 1000): HRReading[] {
  return Array.from({ length: count }, (_, i) => ({
    bpm: Math.round(from + ((to - from) * i) / Math.max(1, count - 1)),
    timestamp: startMs + i * stepMs,
  }));
}

function runDetection(readings: HRReading[]): { detections: number[]; finalState: DetectionState } {
  let state = initialDetectionState();
  const detections: number[] = [];
  for (let i = 0; i < readings.length; i++) {
    const r = stepDetection(state, readings[i]);
    state = r.state;
    if (r.fired) detections.push(i);
  }
  return { detections, finalState: state };
}

// A canonical "set" pattern: ramp up, hold high, drop down, settle.
function compoundSetSequence(startMs: number): HRReading[] {
  return [
    ...rampSeq(95, 130, 6, startMs),                     // 6s rise
    ...constSeq(135, PEAK_HOLD_MIN_SEC + 2, startMs + 6000),  // peak hold (5s)
    ...rampSeq(130, 110, 5, startMs + 11000),             // 5s drop
    ...constSeq(95, RECOVERY_CONFIRM_SEC + 2, startMs + 16000), // recovery confirm (6s)
  ];
}

// Constants used for clarity in tests
const BASELINE_BPM = 90;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('setDetection FSM', () => {
  test('stays dormant until enough baseline samples are collected', () => {
    const readings = constSeq(BASELINE_BPM, MIN_READINGS_FOR_BASELINE - 5, 0);
    const { detections, finalState } = runDetection(readings);
    expect(detections).toEqual([]);
    expect(finalState.phase).toBe('IDLE');
    expect(finalState.idleSamples.length).toBe(MIN_READINGS_FOR_BASELINE - 5);
  });

  test('steady baseline produces no detection', () => {
    const readings = constSeq(BASELINE_BPM, 120, 0);
    const { detections } = runDetection(readings);
    expect(detections).toEqual([]);
  });

  test('a classic compound set (ramp → hold → drop) fires exactly once', () => {
    const readings = [
      ...constSeq(BASELINE_BPM, 60, 0),
      ...compoundSetSequence(60_000),
    ];
    const { detections } = runDetection(readings);
    expect(detections.length).toBe(1);
  });

  test('false-start jitter (single spike then back to baseline) does not fire', () => {
    const readings = [
      ...constSeq(BASELINE_BPM, 60, 0),
      { bpm: BASELINE_BPM + RISE_THRESHOLD_BPM + 5, timestamp: 60_000 }, // momentary spike
      ...constSeq(BASELINE_BPM, 30, 61_000), // back to baseline
    ];
    const { detections, finalState } = runDetection(readings);
    expect(detections).toEqual([]);
    expect(finalState.phase).toBe('IDLE');
  });

  test('two sets in quick succession: cooldown suppresses the second', () => {
    // First set fires around t=60s+; second set begins ~5s after first ends so it
    // completes well within the MIN_TIME_BETWEEN_DETECTIONS_SEC window.
    const set1 = compoundSetSequence(60_000);
    const set1End = set1[set1.length - 1].timestamp;
    // Brief rest at slightly elevated HR so we go through IDLE between sets
    const rest = constSeq(BASELINE_BPM + 2, 5, set1End + 1000);
    const set2 = compoundSetSequence(set1End + 6000);
    const lastSet2 = set2[set2.length - 1].timestamp;
    const set2WithinCooldown = lastSet2 - set1End < MIN_TIME_BETWEEN_DETECTIONS_SEC * 1000;
    expect(set2WithinCooldown).toBe(true);

    const readings = [
      ...constSeq(BASELINE_BPM, 60, 0),
      ...set1,
      ...rest,
      ...set2,
    ];
    const { detections } = runDetection(readings);
    expect(detections.length).toBe(1);
  });

  test('plateau without recovery never fires (PEAK held indefinitely)', () => {
    const readings = [
      ...constSeq(BASELINE_BPM, 60, 0),
      ...rampSeq(BASELINE_BPM + 5, 140, 5, 60_000),
      ...constSeq(140, 60, 65_000), // hold high for 60s, no drop
    ];
    const { detections, finalState } = runDetection(readings);
    expect(detections).toEqual([]);
    expect(finalState.phase).toBe('PEAK');
  });

  test('bounce-back from RECOVERING re-enters PEAK; only the real recovery fires', () => {
    const readings = [
      ...constSeq(BASELINE_BPM, 60, 0),
      ...rampSeq(95, 130, 5, 60_000),       // rise
      ...constSeq(130, 5, 65_000),          // peak hold (5s)
      { bpm: 124, timestamp: 70_000 },      // drops past peak−5 → RECOVERING
      { bpm: 130, timestamp: 71_000 },      // bounce: > peak−2.5 → back to PEAK
      ...constSeq(130, 4, 72_000),          // peak hold again
      ...rampSeq(125, 95, 6, 76_000),       // real drop
      ...constSeq(90, 5, 82_000),           // recovery settle
    ];
    const { detections } = runDetection(readings);
    expect(detections.length).toBe(1);
  });

  test('light-work fallback: after no real spike for 5+ minutes, an 8 bpm rise can fire', () => {
    // 5+ minutes at baseline so light-work mode latches on
    const readings: HRReading[] = [
      ...constSeq(BASELINE_BPM, SESSION_LIGHTWORK_CHECK_SEC + 10, 0),
      ...rampSeq(BASELINE_BPM + 4, BASELINE_BPM + 9, 5, (SESSION_LIGHTWORK_CHECK_SEC + 10) * 1000),
      ...constSeq(BASELINE_BPM + 9, PEAK_HOLD_MIN_SEC + 2, (SESSION_LIGHTWORK_CHECK_SEC + 15) * 1000),
      ...rampSeq(BASELINE_BPM + 4, BASELINE_BPM, 5, (SESSION_LIGHTWORK_CHECK_SEC + 22) * 1000),
      ...constSeq(BASELINE_BPM, RECOVERY_CONFIRM_SEC + 2, (SESSION_LIGHTWORK_CHECK_SEC + 27) * 1000),
    ];
    const { detections, finalState } = runDetection(readings);
    expect(finalState.lightWorkMode).toBe(true);
    expect(detections.length).toBe(1);
    // Sanity: the rise was below the normal threshold
    expect(finalState.maxObservedRise).toBeLessThan(RISE_THRESHOLD_BPM);
  });

  test('rise that never sustains for RISE_SUSTAIN_SEC drops back to IDLE', () => {
    const readings = [
      ...constSeq(BASELINE_BPM, 60, 0),
      // 2-second mini-spike (< RISE_SUSTAIN_SEC) then back
      { bpm: 110, timestamp: 60_000 },
      { bpm: 110, timestamp: 61_000 },
      ...constSeq(BASELINE_BPM, 30, 62_000),
    ];
    const { detections, finalState } = runDetection(readings);
    expect(detections).toEqual([]);
    expect(finalState.phase).toBe('IDLE');
  });

  test('uses RECOVERY_DROP_BPM for the peak→recovery transition', () => {
    // A drop smaller than RECOVERY_DROP_BPM should not begin recovery
    const readings = [
      ...constSeq(BASELINE_BPM, 60, 0),
      ...rampSeq(95, 130, 5, 60_000),
      ...constSeq(130, 5, 65_000),
      ...constSeq(130 - (RECOVERY_DROP_BPM - 1), 10, 70_000), // 4 bpm drop, not enough
    ];
    const { detections, finalState } = runDetection(readings);
    expect(detections).toEqual([]);
    expect(finalState.phase).toBe('PEAK');
  });
});

// ─── findNextUnfilledSet ─────────────────────────────────────────────────────

function ex(name: string, completedFlags: boolean[]): ExerciseLog {
  return {
    name,
    sets: completedFlags.map((completed) => ({ reps: '', weight: '', rpe: '', completed })),
  };
}

describe('findNextUnfilledSet', () => {
  test('returns {0,0} when nothing is started', () => {
    expect(findNextUnfilledSet([ex('Squat', [false, false, false])])).toEqual({ exIdx: 0, setIdx: 0 });
  });

  test('returns the first incomplete set across multiple exercises', () => {
    const exercises = [
      ex('Squat', [true, true, true]),
      ex('Bench', [true, false, false]),
      ex('Row', [false, false]),
    ];
    expect(findNextUnfilledSet(exercises)).toEqual({ exIdx: 1, setIdx: 1 });
  });

  test('returns null when all sets are completed', () => {
    const exercises = [ex('Squat', [true, true]), ex('Bench', [true])];
    expect(findNextUnfilledSet(exercises)).toBeNull();
  });

  test('returns null when there are no exercises', () => {
    expect(findNextUnfilledSet([])).toBeNull();
  });
});
