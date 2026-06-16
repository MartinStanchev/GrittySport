# Background GPS Tracking (iOS + Android)

## Problem
On production iOS builds, GPS tracking stopped the moment the phone was locked. The
recorder used `Location.watchPositionAsync` — a foreground-only JS subscription — and only
requested foreground permission. When the screen locks / the app backgrounds, the OS
suspends the JS runtime and the watcher stops firing, so the run flatlines.

## Fix
Replaced the foreground watcher with a native background location task
(`Location.startLocationUpdatesAsync` + `expo-task-manager`). iOS keeps it alive via the
`location` background mode (blue status-bar indicator); Android via a foreground service
(persistent notification). Locations are buffered at module scope and folded into the
workout state by a pure reducer — both live and on foreground resume after a lock gap.

> ⚠️ Native config changed → requires a new EAS dev/prod build to take effect. It will NOT
> work in the existing installed build or over OTA update.

## Key design
The TaskManager task runs at **module scope** and cannot touch React state. So:
- `locationTrackingService` owns the task, a `RawLocation[]` buffer, and a single listener.
  The task pushes readings into the buffer and pings the listener.
- The screen drains the buffer and folds readings through `applyGPSPoint`, a **pure reducer**
  (no refs/closures), so a whole batch buffered during a lock can be replayed with `reduce`
  and the live single-reading path uses identical maths.
- `drainLocations` writes `gpsWorkoutRef.current` synchronously before `updateGPSWorkout`, so
  rapid back-to-back drains fold onto the latest state, not the last rendered one.
- An `AppState` 'active' listener re-drains on foreground resume to catch the lock-screen gap.

## Files changed
- `frontend/app.json`
  - Android permissions: added `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`.
  - `expo-location` plugin: `isIosBackgroundLocationEnabled`, `isAndroidBackgroundLocationEnabled`,
    `isAndroidForegroundServiceEnabled` all `true`.
  - (iOS `backgroundModes: ["location"]` + `NSLocationAlwaysAndWhenInUse...` were already present.)
- `frontend/package.json` — added `expo-task-manager` (`npx expo install`).
- `frontend/src/services/gpsReducer.ts` (NEW) — `applyGPSPoint` pure reducer + `RawLocation` type
  + thresholds (`MAX_ACCURACY_METRES`, `AUTO_PAUSE_SPEED_THRESHOLD`, `AUTO_PAUSE_POINT_COUNT`,
  `AUTO_LAP_DISTANCE_M`), extracted from the old `handleNewPoint`.
- `frontend/src/services/locationTrackingService.ts` (NEW) — TaskManager task + `start`/`stop`/
  `isRunning`/`setListener`/`drain`. Foreground permission required; background permission
  requested but non-blocking. Android-only `foregroundService` options.
- `frontend/src/contexts/WorkoutContext.tsx` — added ephemeral `slowPointCount` field to
  `ActiveGPSWorkout` (+ init), replacing the screen's `slowPointCountRef` (a ref can't survive a
  background gap / batch replay).
- `frontend/src/screens/RecordGPSScreen.tsx` — removed `handleNewPoint`, `handleAutoPause`,
  `startLocationWatcher`, `slowPointCountRef`, `locationSubRef`; added `drainLocations` + the
  AppState/listener effect; `handleStart` now calls `locationTracking.start()`; start/stop/discard/
  unmount now use `locationTracking.stop()`; resume resets `slowPointCount` via `updateGPSWorkout`.
- `frontend/src/__tests__/gpsReducer.test.ts` (NEW) — 5 tests: not-recording guard, accuracy drop,
  distance accumulation, batch-replay == one-by-one, auto-pause after N stationary readings.

## Behavior preserved / notes
- Auto-pause (3 near-stationary points) and auto-lap (every 1 km) thresholds unchanged.
- Leaving the RecordGPS screen still stops tracking (unmount → `locationTracking.stop()`), same as
  before. Only the lock-screen case improved — locking does not unmount the screen.
- Not covered: surviving a full OS kill of the app while backgrounded (would need persisting raw
  points + workout meta to SQLite and recovering on relaunch). Rare with active background location;
  left as a follow-up.
- Cadence (pedometer) still stops on unmount as before — out of scope for this fix.
