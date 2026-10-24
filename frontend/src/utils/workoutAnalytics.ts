import type { WorkoutAnalytics } from '../types/gps';

/** True when the server analytics contain at least one metric worth rendering. */
export function hasAnalyticsContent(analytics: WorkoutAnalytics | null | undefined): boolean {
  if (!analytics) return false;
  return analytics.effort_score > 0
    || !!analytics.program_alignment
    || (analytics.personal_records?.length ?? 0) > 0
    || !!analytics.trend
    || !!analytics.cardiac_efficiency
    || !!analytics.weekly_trend;
}
