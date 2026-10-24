import {
  activeElapsedSec,
  closePause,
  savedWorkoutDurationSec,
  totalPausedSec,
} from '../utils/workoutDuration';
import { formatDuration } from '../utils/dates';

const START_MS = 1_700_000_000_000;
const start = new Date(START_MS);

describe('activeElapsedSec', () => {
  it('is wall-clock time when never paused', () => {
    const w = { startedAt: start, pausedDurationSec: 0, lastPauseStart: null };
    expect(activeElapsedSec(w, START_MS + 90_000)).toBe(90);
  });

  it('subtracts completed pauses', () => {
    const w = { startedAt: start, pausedDurationSec: 30, lastPauseStart: null };
    expect(activeElapsedSec(w, START_MS + 90_000)).toBe(60);
  });

  it('freezes during an open pause', () => {
    // Paused at 60 s (after a previous 10 s pause) — the value stays put while paused.
    const w = { startedAt: start, pausedDurationSec: 10, lastPauseStart: START_MS + 60_000 };
    expect(activeElapsedSec(w, START_MS + 60_000)).toBe(50);
    expect(activeElapsedSec(w, START_MS + 120_000)).toBe(50);
    expect(activeElapsedSec(w, START_MS + 600_000)).toBe(50);
  });

  it('never goes negative', () => {
    const w = { startedAt: start, pausedDurationSec: 500, lastPauseStart: null };
    expect(activeElapsedSec(w, START_MS + 10_000)).toBe(0);
  });
});

describe('closePause', () => {
  it('folds an open pause into the total so a pause open at Finish is excluded', () => {
    const w = { startedAt: start, pausedDurationSec: 10, lastPauseStart: START_MS + 60_000 };
    const finishMs = START_MS + 180_000;
    const closed = closePause(w, finishMs);

    expect(closed).toEqual({ pausedDurationSec: 130, lastPauseStart: null });
    // Same active time before and after closing — live timer, summary and save all agree.
    expect(activeElapsedSec({ ...w, ...closed }, finishMs)).toBe(activeElapsedSec(w, finishMs));
    expect(activeElapsedSec({ ...w, ...closed }, finishMs)).toBe(50);
  });

  it('is a no-op on the total when not paused', () => {
    const w = { startedAt: start, pausedDurationSec: 25, lastPauseStart: null };
    expect(closePause(w, START_MS + 100_000)).toEqual({ pausedDurationSec: 25, lastPauseStart: null });
    expect(totalPausedSec(w, START_MS + 100_000)).toBe(25);
  });
});

describe('savedWorkoutDurationSec', () => {
  it('excludes paused time (mirrors backend EffectiveDurationSec)', () => {
    expect(savedWorkoutDurationSec({
      started_at: '2026-01-01T10:00:00.000Z',
      finished_at: '2026-01-01T10:30:00.000Z',
      paused_duration_sec: 300,
    })).toBe(1500);
  });

  it('returns null for an unfinished workout', () => {
    expect(savedWorkoutDurationSec({
      started_at: '2026-01-01T10:00:00.000Z',
      paused_duration_sec: 0,
    })).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats seconds and shows a dash for no duration', () => {
    expect(formatDuration(1500)).toBe('25m 0s');
    expect(formatDuration(3725.9)).toBe('1h 2m');
    expect(formatDuration(42.7)).toBe('42s');
    expect(formatDuration(null)).toBe('—');
  });
});
