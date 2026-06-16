import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { RawLocation } from './gpsReducer';

/**
 * Background-capable GPS tracking.
 *
 * `watchPositionAsync` is a foreground-only JS subscription that the OS suspends the
 * moment the screen locks, so points stop arriving. Instead we register a native
 * `TaskManager` location task: iOS keeps it alive via the `location` background mode
 * (blue status-bar indicator) and Android via a foreground service (persistent
 * notification). The task runs at module scope — it cannot touch React state — so it
 * pushes raw readings into a buffer that the screen drains and folds through the GPS
 * reducer, both live and when it returns to the foreground after a lock.
 */

export const GPS_LOCATION_TASK = 'gritty-gps-location-task';

let buffer: RawLocation[] = [];
let listener: (() => void) | null = null;

TaskManager.defineTask(GPS_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  if (!locations?.length) return;
  for (const loc of locations) {
    buffer.push({ coords: loc.coords, timestamp: loc.timestamp });
  }
  listener?.();
});

export interface StartTrackingResult {
  ok: boolean;
  /** Set when ok is false — a user-facing reason. */
  reason?: string;
}

export const locationTracking = {
  /**
   * Requests permission and starts the background location task.
   * Foreground permission is required; background permission is requested but not
   * blocking — iOS keeps delivering while locked under "When In Use" + background mode,
   * and Android keeps delivering via the foreground service.
   */
  async start(): Promise<StartTrackingResult> {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      return { ok: false, reason: 'Location access is needed to track your workout.' };
    }
    // Best-effort: enables tracking while locked without the foreground service on iOS,
    // and unrestricted background delivery on Android. Denial is tolerated.
    await Location.requestBackgroundPermissionsAsync().catch(() => undefined);

    if (await this.isRunning()) return { ok: true };

    try {
      await Location.startLocationUpdatesAsync(GPS_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 5,
        timeInterval: 1000,
        activityType: Location.ActivityType.Fitness,
        pausesUpdatesAutomatically: false,
        ...(Platform.OS === 'android'
          ? {
              foregroundService: {
                notificationTitle: 'Recording your workout',
                notificationBody: 'Gritty Fitness is tracking your route.',
                notificationColor: '#7C5CFC',
                killServiceOnDestroy: true,
              },
            }
          : {}),
      });
      return { ok: true };
    } catch {
      return { ok: false, reason: 'Could not start background location tracking.' };
    }
  },

  async stop(): Promise<void> {
    buffer = [];
    listener = null;
    if (await this.isRunning()) {
      await Location.stopLocationUpdatesAsync(GPS_LOCATION_TASK).catch(() => undefined);
    }
  },

  async isRunning(): Promise<boolean> {
    return Location.hasStartedLocationUpdatesAsync(GPS_LOCATION_TASK).catch(() => false);
  },

  /** Notified whenever new readings are buffered. The callback should `drain()`. */
  setListener(fn: (() => void) | null): void {
    listener = fn;
  },

  /** Returns and clears all buffered readings since the last drain. */
  drain(): RawLocation[] {
    const out = buffer;
    buffer = [];
    return out;
  },
};
