import NetInfo from '@react-native-community/netinfo';
import { saveWorkout, isNetworkError, type SaveWorkoutInput, type WorkoutResponse } from './api';
import { getPendingWorkouts, markSynced, savePendingWorkout } from './offlineStorage';
import { captureError } from './monitoring';

function newLocalWorkoutId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Saves a workout to the server, falling back to the on-device pending queue when
// offline or when the request fails. Returns the server workout on success, or
// null when it was queued for later sync (picked up by syncPendingWorkouts).
export async function saveWorkoutWithFallback(
  payload: SaveWorkoutInput,
): Promise<WorkoutResponse | null> {
  const net = await NetInfo.fetch();
  if (net.isConnected) {
    try {
      return await saveWorkout(payload);
    } catch (e) {
      // A genuine server-side error (not just offline) is worth reporting —
      // the user is online but the save was rejected.
      if (!isNetworkError(e)) captureError(e, { stage: 'saveWorkout', activityType: payload.activity_type });
      // Fall through to the offline queue regardless.
    }
  }
  try {
    await savePendingWorkout({
      id: newLocalWorkoutId(),
      activity_type: payload.activity_type,
      recorded_data: JSON.stringify(payload.recorded_data),
      gps_route: payload.gps_route ? JSON.stringify(payload.gps_route) : undefined,
      heart_rate_data: payload.heart_rate_data ? JSON.stringify(payload.heart_rate_data) : undefined,
      source: payload.source,
      started_at: payload.started_at,
      finished_at: payload.finished_at,
      scheduled_activity_id: payload.scheduled_activity_id,
      notes: payload.notes,
    });
  } catch (e) {
    // The offline queue is the last line of defence — if it fails the workout
    // is at risk, so report it and let the caller surface an error to the user.
    captureError(e, { stage: 'savePendingWorkout', activityType: payload.activity_type });
    throw e;
  }
  return null;
}

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
