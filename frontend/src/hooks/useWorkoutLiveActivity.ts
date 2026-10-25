import { useEffect, useRef } from 'react';
import type { LiveActivity } from 'expo-widgets';
import { WorkoutActivity } from '../services/workoutLiveActivity';
import type { WorkoutActivityProps } from '../utils/liveActivityProps';

// HR and GPS state change every second or so; the clock is drawn by iOS itself, so the
// stats only need refreshing every few seconds. Pause/resume is sent immediately.
const UPDATE_INTERVAL_MS = 5000;

interface Sent {
  json: string;
  clockKey: string;
  at: number;
}

function clockKey(p: WorkoutActivityProps): string {
  return `${p.timerStartMs}|${p.pausedAtMs}`;
}

/**
 * Mirrors the recording workout into an iOS Live Activity (lock screen + Dynamic Island).
 * `props` null means nothing is recording: the activity is ended. No-op off iOS.
 *
 * Mounted in `WorkoutProvider` (like `usePauseNotification`) so it keeps updating while
 * the user is on other screens or the app is backgrounded — GPS workouts stay alive via
 * the background location task, HR-only workouts via the `bluetooth-central` mode.
 */
export function useWorkoutLiveActivity(props: WorkoutActivityProps | null): void {
  const instanceRef = useRef<LiveActivity<WorkoutActivityProps> | null>(null);
  const sentRef = useRef<Sent | null>(null);

  // Workout state is in-memory, so any activity still around at mount belongs to a
  // previous app process (e.g. killed mid-workout) and would show a clock forever.
  useEffect(() => {
    WorkoutActivity?.getInstances().forEach((a) => void a.end('immediate').catch(() => undefined));
    return () => {
      void instanceRef.current?.end('immediate').catch(() => undefined);
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!WorkoutActivity) return;

    if (!props) {
      const instance = instanceRef.current;
      instanceRef.current = null;
      sentRef.current = null;
      if (instance) void instance.end('immediate').catch(() => undefined);
      return;
    }

    const json = JSON.stringify(props);
    const key = clockKey(props);

    if (!instanceRef.current) {
      try {
        instanceRef.current = WorkoutActivity.start(props);
        sentRef.current = { json, clockKey: key, at: Date.now() };
      } catch {
        // Live Activities disabled for the app in iOS Settings, or unsupported device.
      }
      return;
    }

    const sent = sentRef.current;
    if (sent?.json === json) return;

    const instance = instanceRef.current;
    const send = () => {
      sentRef.current = { json, clockKey: key, at: Date.now() };
      void instance.update(props).catch(() => undefined);
    };
    const urgent = !sent || sent.clockKey !== key;
    const delay = urgent ? 0 : Math.max(0, sent.at + UPDATE_INTERVAL_MS - Date.now());
    // Trailing throttle: a newer props value cancels this timer and reschedules against
    // the same last-sent time, so the latest state goes out at most every interval.
    const timer = setTimeout(send, delay);
    return () => clearTimeout(timer);
  }, [props]);
}
