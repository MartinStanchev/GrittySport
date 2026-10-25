import { getActivitySFSymbol, type SFSymbolName } from '../constants/activityIcons';
import type { ActiveGPSWorkout, ActiveWorkout } from '../contexts/WorkoutContext';
import { LIVE_ACTIVITY_METRICS, type LiveActivityMetric } from '../contexts/PreferencesContext';
import { formatDistanceKm, formatPaceSecPerKm, formatSpeedKph, isRunSport } from '../services/gpsUtils';
import { getRecordingStatusLabel } from './liveWorkout';
import { liveClockAnchor } from './workoutDuration';

export interface LiveActivityStat {
  label: string;
  value: string;
  unit: string;
}

/**
 * Everything the workout Live Activity renders. The layout runs in an isolated widget
 * runtime that can't import app code, so every value arrives pre-formatted and the
 * whole object must survive JSON serialization (dates are epoch ms).
 */
export interface WorkoutActivityProps {
  title: string;
  icon: SFSymbolName;
  /** Count-up origin of the active-time clock (see `liveClockAnchor`). */
  timerStartMs: number;
  /** Start of the open pause (freezes the clock), or null while recording. */
  pausedAtMs: number | null;
  /** "Paused" / "Auto-paused" while paused, otherwise null. */
  statusLabel: string | null;
  /** The chosen metric for the compact Dynamic Island, or null when nothing is available. */
  compact: LiveActivityStat | null;
  /** Metrics for the lock-screen banner and expanded Dynamic Island. */
  stats: LiveActivityStat[];
}

type AvailableStats = Partial<Record<LiveActivityMetric, LiveActivityStat>>;

// When the chosen metric isn't available (e.g. pace on a strength workout, HR without a
// strap), the compact slot falls back to the first available one in Settings order.
const FALLBACK_ORDER = LIVE_ACTIVITY_METRICS.map((m) => m.id);
const STATS_ORDER: LiveActivityMetric[] = ['distance', 'pace', 'heart_rate'];

function hrStat(currentHR: number | null): LiveActivityStat | undefined {
  return currentHR != null ? { label: 'HR', value: String(currentHR), unit: 'bpm' } : undefined;
}

function gpsStats(w: ActiveGPSWorkout): AvailableStats {
  return {
    distance: { label: 'Distance', value: formatDistanceKm(w.totalDistanceM), unit: 'km' },
    // Matches the recording screen: pace for runs, speed for everything else.
    pace: isRunSport(w.activityType)
      ? { label: 'Pace', value: formatPaceSecPerKm(w.currentPaceSecPerKm), unit: '/km' }
      : { label: 'Speed', value: formatSpeedKph(w.currentSpeedKph), unit: 'km/h' },
    heart_rate: hrStat(w.currentHR),
  };
}

function build(
  w: ActiveWorkout | ActiveGPSWorkout,
  available: AvailableStats,
  autoPaused: boolean,
  metric: LiveActivityMetric,
): WorkoutActivityProps {
  const compactId = available[metric] ? metric : FALLBACK_ORDER.find((m) => available[m]);
  return {
    title: w.activityDisplayType,
    icon: getActivitySFSymbol(w.activityType),
    ...liveClockAnchor(w),
    statusLabel: w.lastPauseStart != null ? getRecordingStatusLabel('paused', autoPaused) : null,
    compact: compactId ? available[compactId] ?? null : null,
    stats: STATS_ORDER.map((m) => available[m]).filter((s) => s != null),
  };
}

/**
 * Live Activity content for the workout currently being recorded, or null when nothing
 * is recording (not started yet, finished, or on the summary screen) — null ends it.
 */
export function buildWorkoutActivityProps(
  manual: ActiveWorkout | null,
  gps: ActiveGPSWorkout | null,
  metric: LiveActivityMetric,
): WorkoutActivityProps | null {
  if (gps && (gps.recordingState === 'recording' || gps.recordingState === 'paused')) {
    return build(gps, gpsStats(gps), gps.autoPaused, metric);
  }
  if (manual && manual.phase === 'recording') {
    return build(manual, { heart_rate: hrStat(manual.currentHR) }, false, metric);
  }
  return null;
}
