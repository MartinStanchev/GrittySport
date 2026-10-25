import type { HRReading, Lap } from '../types/gps';
import { summarizeHR } from '../services/gpsUtils';
import { activeElapsedSec, type PauseTracking } from './workoutDuration';

/** A lap of an indoor (treadmill / stationary bike) session — no distance, just time and HR. */
export type IndoorLap = Pick<Lap, 'lap_number' | 'start_time' | 'end_time' | 'duration_sec' | 'avg_hr'>;

interface LapSource extends PauseTracking {
  laps: IndoorLap[];
  hrReadings: HRReading[];
}

// A Lap press within a second of the previous one is a double tap, not a lap.
const MIN_LAP_SEC = 1;

/**
 * Closes the current lap at `nowMs`: it runs from the previous lap's end (or the start)
 * and counts active time only, so paused time never lands in a lap. Returns null when
 * the lap would be shorter than a second.
 */
export function buildIndoorLap(w: LapSource, nowMs: number): IndoorLap | null {
  const startTime = w.laps[w.laps.length - 1]?.end_time ?? w.startedAt.getTime();
  const activeBefore = w.laps.reduce((sum, lap) => sum + lap.duration_sec, 0);
  const durationSec = activeElapsedSec(w, nowMs) - activeBefore;
  if (durationSec < MIN_LAP_SEC) return null;
  const lapHR = w.hrReadings.filter((r) => r.timestamp >= startTime && r.timestamp <= nowMs);
  return {
    lap_number: w.laps.length + 1,
    start_time: startTime,
    end_time: nowMs,
    duration_sec: durationSec,
    avg_hr: summarizeHR(lapHR).avg_hr,
  };
}

/**
 * Laps only exist once the user presses Lap, so on finish the stretch after the last
 * press is closed into a final lap. No presses stays no laps.
 */
export function closeFinalIndoorLap(w: LapSource, finishedMs: number): IndoorLap[] {
  if (w.laps.length === 0) return w.laps;
  const last = buildIndoorLap(w, finishedMs);
  return last ? [...w.laps, last] : w.laps;
}

/**
 * The `recorded_data` saved for an indoor session (Grit reads it as-is in reviews).
 * `laps` are the laps worth listing (see `hasRecordedLaps`) — empty when there are none.
 */
export function buildIndoorRecordedData(params: {
  hrReadings: HRReading[];
  laps: IndoorLap[];
  calories: number;
}): Record<string, unknown> {
  const { hrReadings, laps, calories } = params;
  return {
    ...summarizeHR(hrReadings),
    ...(calories > 0 ? { calories } : {}),
    ...(laps.length > 0
      ? { laps: laps.map((lap) => ({ ...lap, duration_sec: Math.round(lap.duration_sec) })) }
      : {}),
  };
}
