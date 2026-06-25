# HR Monitor Auto-Connect

Automatically reconnect to the last-used Bluetooth heart rate monitor when a recording screen opens — before the user taps start — so HR is already streaming by the time they begin a workout.

## Behavior

- On a **successful** HR connection (`bleService.connect`), the device `{id, name}` is persisted to `expo-secure-store` (`gritty_last_hr_device`).
- When `RecordGPSScreen` or `RecordManualScreen` mounts, a shared `useHRAutoConnect` hook speculatively calls `bleService.autoConnect()`, which reads the remembered device and attempts a direct `connectToDevice(id, { timeout: 8s })`. It **never throws** — out-of-range / BLE-off / nothing-remembered all resolve to `null` silently.
- GPS screen shows a transient `Connecting to <device>…` label on the sensor row while the attempt is in flight (via `connectingTo` from the hook).
- The pre-start connected device name is carried into the workout at start time through a shared `connectedHRDeviceName()` helper in `WorkoutContext` (used by both `startWorkout` and `startGPSWorkout`).
- Explicit **Disconnect** in `HRSensorModal` also calls `forgetLastDevice()`, so a deliberate disconnect is respected and won't auto-reconnect next time. The automatic unmount disconnect (when the user backs out before starting) does **not** forget.
- The hook owns unmount teardown: if no workout is active at unmount, an auto-connected monitor is dropped so the BLE connection isn't leaked.

## Key files changed

- `frontend/src/services/bleService.native.ts` — `autoConnect`, `getLastDevice`, `forgetLastDevice`, private `rememberDevice` + `attachToDevice` (shared by `connect`/`autoConnect`); SecureStore persistence; `_autoConnecting` guard.
- `frontend/src/services/bleService.ts` / `bleService.web.ts` — matching no-op stubs + `RememberedHRDevice` type.
- `frontend/src/hooks/useHRAutoConnect.ts` — new shared hook: runs once on mount, exposes `connectingTo`, and owns the unmount-disconnect cleanup via `hasActiveWorkout`.
- `frontend/src/screens/RecordGPSScreen.tsx` — wired hook, `connectingTo` label.
- `frontend/src/screens/RecordManualScreen.tsx` — wired hook (replaces its old standalone unmount-disconnect effect).
- `frontend/src/contexts/WorkoutContext.tsx` — `connectedHRDeviceName()` helper; `hrDeviceName` added to `GPSWorkoutInitFields`; both start paths initialize it identically.
- `frontend/src/components/HRSensorModal.tsx` — explicit Disconnect now also forgets the device.

## Notes

- Native-only (BLE requires a dev build); web/Expo Go stubs no-op.
- Pre-existing unrelated `tsc` errors remain in `LiveHRChart`/`WorkoutCharts`/`useNotifications` (third-party chart + expo-notifications type drift); not touched.
- Validated: `tsc` clean on touched files, eslint clean, all 248 Jest tests pass. Code-simplifier run applied 3 behavior-preserving cleanups (centralized unmount cleanup, de-duplicated device-name carry-over, replaced nested ternary with a helper).
