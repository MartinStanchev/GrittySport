import { useEffect, useRef, useState } from 'react';
import { bleService } from '../services/bleService';

interface UseHRAutoConnectArgs {
  // Streams each HR reading once connected.
  onReading: (bpm: number) => void;
  // Called with the device name when an auto-connection succeeds.
  onConnected: (deviceName: string) => void;
  // Gate auto-connect on a screen-specific condition (defaults to true).
  enabled?: boolean;
  // Returns true if a workout is still active at unmount, in which case the BLE
  // connection is kept alive. Otherwise an auto-connected monitor is dropped on
  // unmount so we don't leak the connection when the user backs out before recording.
  hasActiveWorkout?: () => boolean;
}

interface UseHRAutoConnectResult {
  // Name of the remembered device we are attempting to reach, while attempting.
  connectingTo: string | null;
}

// Speculatively reconnects to the last-used HR monitor when a recording screen
// mounts, so a connection is already live before the user taps start. Runs once,
// silently no-ops when BLE is unavailable, nothing is remembered, or a device is
// already connected (e.g. resuming an in-progress workout).
export function useHRAutoConnect({
  onReading,
  onConnected,
  enabled = true,
  hasActiveWorkout,
}: UseHRAutoConnectArgs): UseHRAutoConnectResult {
  const [connectingTo, setConnectingTo] = useState<string | null>(null);
  const onReadingRef = useRef(onReading);
  const onConnectedRef = useRef(onConnected);
  const hasActiveWorkoutRef = useRef(hasActiveWorkout);
  onReadingRef.current = onReading;
  onConnectedRef.current = onConnected;
  hasActiveWorkoutRef.current = hasActiveWorkout;

  useEffect(() => {
    if (!enabled || !bleService.available || bleService.isConnected()) return;

    let cancelled = false;
    void (async () => {
      const remembered = await bleService.getLastDevice();
      if (cancelled || !remembered) return;

      setConnectingTo(remembered.name);
      const name = await bleService.autoConnect((bpm) => onReadingRef.current(bpm));
      if (cancelled) return;

      if (name) onConnectedRef.current(name);
      setConnectingTo(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Drop an auto-connected monitor on unmount unless a workout is in progress, so
  // we don't leak the BLE connection when the user backs out before recording.
  useEffect(() => {
    return () => {
      if (!hasActiveWorkoutRef.current?.() && bleService.isConnected()) {
        bleService.disconnect();
      }
    };
  }, []);

  return { connectingTo };
}
