import type { ActiveGPSWorkout } from '../contexts/WorkoutContext';
import type { GPSPoint } from '../types/gps';
import {
  haversineMetres,
  rollingPaceSecPerKm,
  currentSpeedKph,
  avgPaceSecPerKm,
  avgSpeedKph,
  computeElevationGain,
  triggerLap,
} from './gpsUtils';

export const MAX_ACCURACY_METRES = 50;
// Looser than MAX_ACCURACY_METRES — applied only while auto-paused (see applyGPSPoint).
export const RESUME_MAX_ACCURACY_METRES = 100;
export const AUTO_PAUSE_SPEED_THRESHOLD = 0.5; // m/s
export const AUTO_PAUSE_POINT_COUNT = 5; // ~5s of near-stillness before auto-pausing
export const AUTO_RESUME_DISTANCE_M = 10; // displacement from the pause spot that counts as moving
export const AUTO_RESUME_POINT_COUNT = 3; // consecutive moving readings before auto-resuming
export const AUTO_LAP_DISTANCE_M = 1000;

/** A single raw location reading, as delivered by either the live or background watcher. */
export interface RawLocation {
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number | null;
    speed: number | null;
  };
  timestamp: number; // Unix ms
}

/**
 * Folds one raw location reading into the GPS workout state and returns the next state.
 *
 * Pure: derives everything from `workout` (no refs/closures), so a batch of readings
 * buffered while the app was backgrounded can be replayed with a simple `reduce`, and
 * the live single-reading path uses the exact same maths.
 *
 * Returns the input `workout` unchanged when the reading is ignored (not recording, or
 * accuracy too poor) so callers can cheaply detect "nothing changed" by identity.
 *
 * `autoPauseEnabled` (a user setting) gates both auto-pausing while recording and
 * auto-resuming an auto-paused session; when off, only manual pause/resume apply.
 */
export function applyGPSPoint(
  workout: ActiveGPSWorkout,
  loc: RawLocation,
  autoPauseEnabled = true,
): ActiveGPSWorkout {
  const { latitude, longitude, altitude, accuracy, speed } = loc.coords;

  // While auto-paused, watch for sustained movement to auto-resume. This runs BEFORE the
  // strict recording-path accuracy gate below, using the looser RESUME_MAX_ACCURACY_METRES
  // instead: if accuracy degrades (pocket, urban canyon) while paused, the strict gate would
  // drop every fix before detectAutoResume ever runs, deadlocking the workout in 'paused'
  // forever. detectAutoResume itself requires displacement beyond the fix's own uncertainty
  // to reject noisy fixes. A manual pause (autoPaused === false) is left alone — only the
  // user resumes it.
  if (workout.recordingState === 'paused') {
    if (!autoPauseEnabled || !workout.autoPaused) return workout;
    if (accuracy !== null && accuracy > RESUME_MAX_ACCURACY_METRES) return workout;
    return detectAutoResume(workout, loc);
  }

  if (workout.recordingState !== 'recording') return workout;

  // Drop low-quality fixes while actively recording so GPS noise can't corrupt the track.
  if (accuracy !== null && accuracy > MAX_ACCURACY_METRES) return workout;

  const newPoint: GPSPoint = {
    lat: latitude,
    lng: longitude,
    altitude: altitude ?? null,
    accuracy: accuracy ?? 0,
    speed: speed ?? null,
    timestamp: loc.timestamp,
    distance_from_prev: 0,
  };

  const points = workout.points;
  const prevPoint = points.length > 0 ? points[points.length - 1] : null;
  if (prevPoint) {
    newPoint.distance_from_prev = haversineMetres(prevPoint, newPoint);
  }

  const allPoints = [...points, newPoint];
  const newDistanceM = workout.totalDistanceM + newPoint.distance_from_prev;

  // Speed-based auto-pause: pause after a run of near-stationary points.
  const timeDeltaSec = prevPoint ? (newPoint.timestamp - prevPoint.timestamp) / 1000 : 0;
  const computedSpeedMs =
    prevPoint && timeDeltaSec > 0.5 ? newPoint.distance_from_prev / timeDeltaSec : null;

  let slowPointCount = workout.slowPointCount;
  if (autoPauseEnabled && computedSpeedMs !== null && computedSpeedMs < AUTO_PAUSE_SPEED_THRESHOLD) {
    slowPointCount += 1;
    if (slowPointCount >= AUTO_PAUSE_POINT_COUNT) {
      // Drop this point and pause; auto-resume (or the user) resets the counters.
      return {
        ...workout,
        recordingState: 'paused',
        autoPaused: true,
        lastAutoPauseStart: newPoint.timestamp,
        slowPointCount: 0,
        movingPointCount: 0,
      };
    }
  } else {
    slowPointCount = 0;
  }

  // Auto-lap every kilometre.
  let laps = workout.laps;
  let lapStartIndex = workout.lapStartIndex;
  let lapStartDistanceM = workout.lapStartDistanceM;
  if (newDistanceM - lapStartDistanceM >= AUTO_LAP_DISTANCE_M) {
    laps = [...laps, triggerLap(allPoints, lapStartIndex, laps, workout.hrReadings)];
    lapStartIndex = allPoints.length - 1;
    lapStartDistanceM = newDistanceM;
  }

  const totalSec =
    (newPoint.timestamp - workout.startedAt.getTime()) / 1000 - workout.autoPausedDurationSec;
  // Elevation smoothing is O(n); recompute periodically rather than every point.
  const elevationGainM =
    allPoints.length % 10 === 0 ? computeElevationGain(allPoints) : workout.elevationGainM;

  return {
    ...workout,
    points: allPoints,
    totalDistanceM: newDistanceM,
    currentPaceSecPerKm: rollingPaceSecPerKm(allPoints),
    avgPaceSecPerKm: avgPaceSecPerKm(newDistanceM, totalSec),
    currentSpeedKph: currentSpeedKph(allPoints),
    avgSpeedKph: avgSpeedKph(newDistanceM, totalSec),
    elevationGainM,
    laps,
    lapStartIndex,
    lapStartDistanceM,
    slowPointCount,
    movingPointCount: 0,
  };
}

/**
 * Decides whether an auto-paused session should resume. We compare each incoming fix to
 * the spot where recording paused (the last recorded point) rather than to the previous
 * reading: a stationary user's fixes jitter around that spot, while a moving user walks
 * steadily away from it. A fix only counts as movement once it clears both
 * AUTO_RESUME_DISTANCE_M and its own reported accuracy — otherwise a noisy, low-quality
 * fix could "jitter" past the pause spot by more than its own uncertainty and look like
 * movement. Requiring AUTO_RESUME_POINT_COUNT consecutive qualifying fixes filters out
 * single noisy jumps before recording restarts.
 */
function detectAutoResume(workout: ActiveGPSWorkout, loc: RawLocation): ActiveGPSWorkout {
  const pausePoint = workout.points.length > 0 ? workout.points[workout.points.length - 1] : null;
  const movedM = pausePoint
    ? haversineMetres(pausePoint, { lat: loc.coords.latitude, lng: loc.coords.longitude } as GPSPoint)
    : 0;
  const resumeThresholdM = Math.max(AUTO_RESUME_DISTANCE_M, loc.coords.accuracy ?? 0);

  if (movedM < resumeThresholdM) {
    // Jitter, not real movement — reset the streak (cheap no-op if already zero).
    return workout.movingPointCount === 0 ? workout : { ...workout, movingPointCount: 0 };
  }

  const movingPointCount = workout.movingPointCount + 1;
  if (movingPointCount < AUTO_RESUME_POINT_COUNT) {
    return { ...workout, movingPointCount };
  }

  // Sustained movement: credit the paused gap, flip back to recording, and fold this
  // reading through the normal path so the track reconnects from where they stopped.
  const pausedGapSec = workout.lastAutoPauseStart
    ? (loc.timestamp - workout.lastAutoPauseStart) / 1000
    : 0;
  const resumed: ActiveGPSWorkout = {
    ...workout,
    recordingState: 'recording',
    autoPaused: false,
    lastAutoPauseStart: null,
    autoPausedDurationSec: workout.autoPausedDurationSec + pausedGapSec,
    slowPointCount: 0,
    movingPointCount: 0,
  };
  return applyGPSPoint(resumed, loc);
}
