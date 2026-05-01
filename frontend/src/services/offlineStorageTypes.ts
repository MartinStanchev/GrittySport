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
  scheduled_activity_id?: string;
  notes?: string;
}

export const CacheKeys = {
  userProfile: 'user_profile',
  activeProgram: 'active_program',
  upcomingActivities: 'upcoming_activities',
} as const;

export type CacheKey = (typeof CacheKeys)[keyof typeof CacheKeys];
