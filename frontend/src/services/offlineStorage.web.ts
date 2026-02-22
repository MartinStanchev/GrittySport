// Web stub — expo-sqlite is native-only; offline queue not supported on web
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

export async function savePendingWorkout(_workout: LocalPendingWorkout): Promise<void> {}
export async function getPendingWorkouts(): Promise<LocalPendingWorkout[]> { return []; }
export async function markSynced(_id: string): Promise<void> {}
export async function clearSynced(): Promise<void> {}
