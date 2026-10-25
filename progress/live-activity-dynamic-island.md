# Live Activity / Dynamic Island (iOS)

While a workout is recording (GPS or manual — strength/mobility/drill), iOS shows a Live Activity on the lock screen and in the Dynamic Island with the workout clock and live stats. Built with `expo-widgets` (+ `@expo/ui` SwiftUI components); needs a new native build.

## What it shows
- **Lock-screen banner:** sport icon + title (+ "Paused"/"Auto-paused"), big active-time clock, and the available stats (GPS: distance, pace or speed, HR; manual: HR when a strap is connected).
- **Compact Dynamic Island:** clock (leading) + the user-chosen metric (trailing). Pause icon replaces the metric while paused.
- **Minimal:** sport icon, or pause icon while paused.
- **Expanded:** title/status, clock, and all stats.

## How it works
- **Clock:** drawn by iOS (`Text timerInterval` + `pauseTime`), so no per-second updates. `liveClockAnchor` in `utils/workoutDuration.ts` gives the count-up origin (`startedAt` + closed pauses) and the freeze point (open pause start) — same maths as `activeElapsedSec`.
- **Props:** `utils/liveActivityProps.ts` `buildWorkoutActivityProps(manual, gps, metric)` is a pure builder returning pre-formatted, JSON-safe props (the layout runs in an isolated widget runtime and can't import app code), or null when nothing is recording. Pace for runs / speed otherwise (matches the recording screen). Units are km like the live recording screen.
- **Chosen metric:** `liveActivityMetric` (`heart_rate` default / `pace` / `distance`) in `PreferencesContext` (device-local, SecureStore), picked in Settings → Workout Tracking (iOS only). If unavailable (no HR strap, pace/distance on manual workouts) it falls back to the first available in that order.
- **Lifecycle:** `hooks/useWorkoutLiveActivity.ts`, mounted in `WorkoutProvider` next to `usePauseNotification`. Starts when recording starts, updates with a trailing throttle (≤ every 5 s; pause/resume immediately), ends (`immediate`) on finish/discard. On mount it ends any leftover activities from a previous app process (workout state is in-memory).
- **Background:** `react-native-ble-plx` plugin `modes: ["central"]` adds `bluetooth-central` so HR-only (manual) workouts keep receiving HR and updating the Live Activity when backgrounded; GPS workouts were already kept alive by the location background mode.
- **Platform split:** `services/workoutLiveActivity.ios.tsx` (layout + `createLiveActivity`) and `services/workoutLiveActivity.tsx` (null stub for Android/web — Android's native module has no `LiveActivityFactory`). The stub must be `.tsx`, not `.ts`: Metro tries `.ts` before `.ios.tsx`, so a `.ts` stub would shadow the iOS file.

## Related cleanups
- `getRecordingStatusLabel(state, autoPaused)` now returns "Paused" for manual pauses (was always "Auto-paused" in the GPS status header); reused for the GPS pause chip and the Live Activity.
- `ACTIVITY_SF_SYMBOLS` / `getActivitySFSymbol` in `constants/activityIcons.ts` (exhaustive over `ActivityType`).
- Settings: local `SegmentedToggle` shared by Units and the new Dynamic Island metric picker; `PreferencesContext` `persist()` helper.

## Native config (verified via scratch `expo prebuild`)
- `expo-widgets` plugin adds the `ExpoWidgetsTarget` extension (`com.grittyfitness.app.ExpoWidgetsTarget`), App Group `group.com.grittyfitness.app` on both targets, `NSSupportsLiveActivities`, and the EAS `appExtensions` entry. EAS will need to create credentials/provisioning for the extension + App Group on the next build.
- `UIBackgroundModes`: `fetch, location, bluetooth-central`.

## Gotcha: clear the Metro cache after adding expo-widgets
- `babel-preset-expo` only adds its `'widget'`-directive transform when `expo-widgets` resolves, and that check isn't part of Metro's transform cache key. A stale cache served the layout as a plain function, and the dev build crashed at startup with `LiveActivityFactory ... The 2nd argument cannot be cast to type String`. Fix: `npx expo start --clear` once. EAS builds start from a clean cache, so they're unaffected.

## Validation
- `tsc` 0 errors, Jest 319/319 (new `liveActivityProps.test.ts`), lint 0 errors (no new warnings). `expo export` confirms iOS bundles the layout and Android/web get the stub.
- Not verified here: on-device rendering (layout sizing in the compact island, especially the clock width cap of 64 pt), background HR updates for manual workouts, Live Activity start/stop on a real device.

## Not done (follow-ups)
- Android ongoing notification (`expo-widgets` `createCustomNotification`).
- Imperial units (the live recording screen is km-only too).
- Deep link on tap (the app just opens; there's no linking config).
