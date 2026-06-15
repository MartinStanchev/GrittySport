import type { ScheduledActivityResponse } from '../services/api';
import { startOfDay } from './dates';

export interface AdherenceCounts {
  /** Scheduled sessions that have a linked recorded workout. */
  done: number;
  /** Past sessions with no linked workout (missed = skipped). */
  skipped: number;
  /** Today or future sessions not yet completed. */
  upcoming: number;
  /** done + skipped + upcoming (passive types excluded). */
  total: number;
}

// Activity types that don't represent a loggable session and so are excluded
// from adherence — a user never "completes" a rest day, and counting these
// would permanently inflate the skipped count. Mirrors the backend's
// notifications.PassiveActivityTypes.
const PASSIVE_TYPES = new Set(['rest', 'recovery', 'mobility', 'yoga']);

function isPassive(activityType: string): boolean {
  return PASSIVE_TYPES.has(activityType.toLowerCase());
}

/**
 * Tallies completion status across a set of scheduled activities. Done means a
 * workout is linked; an unlinked session in the past counts as skipped, and
 * today/future unlinked sessions are upcoming. Passive (rest/recovery) types
 * are ignored entirely.
 */
export function computeAdherence(
  activities: ScheduledActivityResponse[],
  now: Date = new Date(),
): AdherenceCounts {
  const today = startOfDay(now);
  let done = 0;
  let skipped = 0;
  let upcoming = 0;

  for (const a of activities) {
    if (isPassive(a.activity_type)) continue;
    if (a.linked_workout_id) {
      done++;
    } else if (startOfDay(new Date(a.date + 'T00:00:00')) < today) {
      skipped++;
    } else {
      upcoming++;
    }
  }

  return { done, skipped, upcoming, total: done + skipped + upcoming };
}
