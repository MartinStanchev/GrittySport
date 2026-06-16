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
export const AUTO_PAUSE_SPEED_THRESHOLD = 0.5; // m/s
export const AUTO_PAUSE_POINT_COUNT = 3;
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
 */
export function applyGPSPoint(workout: ActiveGPSWorkout, loc: RawLocation): ActiveGPSWorkout {
  if (workout.recordingState !== 'recording') return workout;

  const { latitude, longitude, altitude, accuracy, speed } = loc.coords;
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
  if (computedSpeedMs !== null && computedSpeedMs < AUTO_PAUSE_SPEED_THRESHOLD) {
    slowPointCount += 1;
    if (slowPointCount >= AUTO_PAUSE_POINT_COUNT) {
      // Drop this point and pause; resuming resets the counter.
      return { ...workout, recordingState: 'paused', lastAutoPauseStart: newPoint.timestamp, slowPointCount: 0 };
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
  };
}
