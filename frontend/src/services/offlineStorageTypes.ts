// Shared types/constants for offlineStorage. Kept in a separate file (no platform
// suffix) so that offlineStorage.native.ts and offlineStorage.web.ts can re-export
// from here without Metro resolving the import back to the importing file itself.

export interface LocalPendingWorkout {
  id: string;
  activity_type: string;
  recorded_data: string;
  gps_route?: string;
  heart_rate_data?: string;
  source: string;
  started_at: string;
  finished_at?: string;
  paused_duration_sec?: number;
  scheduled_activity_id?: string;
  notes?: string;
}

export const CacheKeys = {
  userProfile: 'user_profile',
  activeProgram: 'active_program',
  upcomingActivities: 'upcoming_activities',
  recentWorkouts: 'recent_workouts',
} as const;

// Cache keys are plain strings so dynamic, id-scoped keys (e.g. a per-program
// detail snapshot via programDetailKey) work alongside the fixed CacheKeys above.
export type CacheKey = string;

export function programDetailKey(programId: string): CacheKey {
  return `program_detail:${programId}`;
}
