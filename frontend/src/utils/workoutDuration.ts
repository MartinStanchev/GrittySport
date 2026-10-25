import type { WorkoutResponse } from '../services/api';

/**
 * Pause bookkeeping shared by every live recording (manual and GPS). Manual pauses and
 * GPS auto-pauses both land here, so one set of helpers derives the active duration.
 */
export interface PauseTracking {
  startedAt: Date;
  /** Total seconds of pauses that have already ended. */
  pausedDurationSec: number;
  /** Unix ms the current pause began, or null while recording. */
  lastPauseStart: number | null;
}

/** Seconds paused so far, including a pause still open at `nowMs`. */
export function totalPausedSec(w: PauseTracking, nowMs: number): number {
  const openPauseSec = w.lastPauseStart != null ? Math.max(0, nowMs - w.lastPauseStart) / 1000 : 0;
  return w.pausedDurationSec + openPauseSec;
}

/**
 * Active (unpaused) seconds of a recording at `nowMs`. The single source of truth for
 * the live timer, the summary "Time", the saved duration and avg pace/speed. For a
 * finished recording pass its `finishedAt` time.
 */
export function activeElapsedSec(w: PauseTracking, nowMs: number): number {
  return Math.max(0, (nowMs - w.startedAt.getTime()) / 1000 - totalPausedSec(w, nowMs));
}

/**
 * Anchors for a clock drawn outside JS (the iOS Live Activity): counting up from
 * `timerStartMs` (start shifted by closed pauses) gives active time, and `pausedAtMs`
 * (the open pause, if any) is where it freezes. Equivalent to `activeElapsedSec`.
 */
export function liveClockAnchor(w: PauseTracking): { timerStartMs: number; pausedAtMs: number | null } {
  return {
    timerStartMs: Math.round(w.startedAt.getTime() + w.pausedDurationSec * 1000),
    pausedAtMs: w.lastPauseStart,
  };
}

/** Folds an open pause into the total — apply on resume and on finish. */
export function closePause(
  w: PauseTracking,
  nowMs: number,
): Pick<PauseTracking, 'pausedDurationSec' | 'lastPauseStart'> {
  return { pausedDurationSec: totalPausedSec(w, nowMs), lastPauseStart: null };
}

/**
 * Active duration of a saved workout (mirrors the backend's `EffectiveDurationSec`),
 * or null when it has no finish time.
 */
export function savedWorkoutDurationSec(
  w: Pick<WorkoutResponse, 'started_at' | 'finished_at' | 'paused_duration_sec'>,
): number | null {
  if (!w.finished_at) return null;
  const wallSec = (new Date(w.finished_at).getTime() - new Date(w.started_at).getTime()) / 1000;
  return Math.max(0, wallSec - w.paused_duration_sec);
}
