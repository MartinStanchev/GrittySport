import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import type { GPSRecordingState } from '../contexts/WorkoutContext';

/**
 * Presents a local notification the moment a GPS recording pauses, so a paused
 * workout is never silent — the incident this guards against is an accidental
 * Pause tap (or an unnoticed auto-pause) going undetected until the user checks
 * the app much later, losing the rest of the activity.
 *
 * Auto-pause is detected inside the GPS reducer from location points drained by
 * the background location task (see `locationTrackingService.ts`), which keeps
 * JS running while backgrounded. Watching `recordingState` here therefore catches
 * both manual and auto pauses, including ones that happen in the background.
 *
 * Mounted in `WorkoutProvider`, NOT the recording screen: tracking keeps running
 * when the user navigates away mid-workout, so the notification must outlive the
 * screen too.
 *
 * Notification permission is only checked, never requested, here — this hook
 * must not prompt the user mid-workout.
 */
export function usePauseNotification(recordingState: GPSRecordingState, autoPaused: boolean): void {
  const notificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      if (recordingState === 'paused') {
        if (notificationIdRef.current) return; // already showing for this pause

        const { status } = await Notifications.getPermissionsAsync();
        if (cancelled || status !== 'granted') return;

        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Workout paused',
            body: autoPaused
              ? "Auto-paused because you stopped moving — distance isn't being tracked. Move to resume, or open the app."
              : 'Recording is paused — distance is not being tracked. Return to the app to resume.',
          },
          trigger: null,
        }).catch(() => null);

        if (cancelled) {
          if (id) void Notifications.dismissNotificationAsync(id).catch(() => undefined);
          return;
        }
        notificationIdRef.current = id;
      } else if (notificationIdRef.current) {
        const id = notificationIdRef.current;
        notificationIdRef.current = null;
        void Notifications.dismissNotificationAsync(id).catch(() => undefined);
      }
    }

    void sync();

    return () => {
      cancelled = true;
    };
  }, [recordingState, autoPaused]);

  // Belt-and-braces: don't leak a notification past the provider's lifetime (e.g. the
  // recording state and this effect racing on teardown).
  useEffect(() => () => {
    if (notificationIdRef.current) {
      void Notifications.dismissNotificationAsync(notificationIdRef.current).catch(() => undefined);
      notificationIdRef.current = null;
    }
  }, []);
}
