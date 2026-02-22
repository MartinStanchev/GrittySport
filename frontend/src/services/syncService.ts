import { saveWorkout } from './api';
import { getPendingWorkouts, markSynced } from './offlineStorage';

export async function syncPendingWorkouts(): Promise<void> {
  let pending;
  try {
    pending = await getPendingWorkouts();
  } catch {
    return; // DB not initialised yet — skip
  }

  for (const w of pending) {
    try {
      await saveWorkout({
        activity_type: w.activity_type,
        recorded_data: JSON.parse(w.recorded_data),
        gps_route: w.gps_route ? JSON.parse(w.gps_route) : undefined,
        heart_rate_data: w.heart_rate_data ? JSON.parse(w.heart_rate_data) : undefined,
        source: w.source as 'gps' | 'manual' | 'garmin' | 'apple_health',
        started_at: w.started_at,
        finished_at: w.finished_at,
        scheduled_activity_id: w.scheduled_activity_id,
        notes: w.notes,
      });
      await markSynced(w.id);
    } catch {
      // Leave as pending — will retry on next sync trigger
    }
  }
}
