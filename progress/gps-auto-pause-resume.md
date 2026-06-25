# GPS Auto-Pause / Auto-Resume + Settings Toggle

Adds automatic pause/resume to live GPS recording: recording pauses after a run of
near-stationary fixes (e.g. waiting at a red light) and resumes once sustained movement
is detected. Gated by a new device-local setting so users can turn it off.

## Motivation

The reducer already had a half-finished auto-pause (it paused after 3 slow points) but
**never auto-resumed** — once `recordingState !== 'recording'`, every fix was dropped, so
the runner was stuck paused until they manually tapped Resume. There was also no way to
distinguish an automatic pause from a manual one, and no user control over the behavior.

## Behavior

- **Auto-pause:** while recording, count consecutive fixes whose point-to-point speed is
  below `AUTO_PAUSE_SPEED_THRESHOLD` (0.5 m/s). After `AUTO_PAUSE_POINT_COUNT` (bumped
  3 → **5**, ≈5 s, per the requested "5s or a bit more") it flips to `paused` with
  `autoPaused: true` and drops the triggering point.
- **Auto-resume:** while auto-paused, compare each incoming fix to the **pause spot** (the
  last recorded point), not the previous reading — a stationary user's fixes jitter around
  the spot, a moving user walks steadily away. After `AUTO_RESUME_POINT_COUNT` (3)
  consecutive fixes past `AUTO_RESUME_DISTANCE_M` (10 m), it resumes, credits the paused
  gap into `autoPausedDurationSec`, and folds the fix through the normal path so the track
  reconnects.
- **Robustness vs. messy GPS:** poor-accuracy fixes (`> MAX_ACCURACY_METRES` = 50 m) are
  dropped in *all* states; both pause and resume require a *consecutive* streak, so a
  single noisy jump can't trigger either (a jitter fix resets the streak).
- **Manual vs. auto:** a manual Pause sets `autoPaused: false`, so the reducer never
  auto-resumes it — only the user does. The on-map pause chip now reads "Auto-paused" vs.
  "Paused" accordingly.
- **Setting:** `autoPauseEnabled` (default on) gates both auto-pause and auto-resume; when
  off, only manual pause/resume apply.

## Key files

- `frontend/src/services/gpsReducer.ts` — `applyGPSPoint(workout, loc, autoPauseEnabled=true)`;
  new `detectAutoResume` helper; constants `AUTO_RESUME_DISTANCE_M`,
  `AUTO_RESUME_POINT_COUNT`; `AUTO_PAUSE_POINT_COUNT` 3 → 5; accuracy filter moved ahead of
  the state check.
- `frontend/src/contexts/WorkoutContext.tsx` — `ActiveGPSWorkout` gains `autoPaused` and
  `movingPointCount` (init + `GPSWorkoutInitFields`).
- `frontend/src/contexts/PreferencesContext.tsx` — **new** device-local prefs context
  (`autoPauseEnabled`), persisted via `expo-secure-store` key `gps_auto_pause_enabled`,
  modeled on `ThemeContext`.
- `frontend/App.tsx` — wraps the tree in `PreferencesProvider` (inside `ThemeProvider`).
- `frontend/src/screens/RecordGPSScreen.tsx` — reads the setting via a ref so the location
  listener stays stable; threads it into the reducer in `drainLocations`; manual
  pause/resume reset `autoPaused`/`movingPointCount`; honest pause-chip label.
- `frontend/src/screens/SettingsScreen.tsx` — new "Workout Tracking" section with an
  auto-pause toggle (reuses `themeToggle` styles).
- `frontend/src/__tests__/gpsReducer.test.ts` — tests for auto-pause, no-pause-when-off,
  auto-resume after movement, no-resume-when-off, and manual-pause-not-resumed.

## Notes

- Reducer stays pure, so the background-buffer replay path (`reduce`) and the live path
  use identical maths, including resume.
- Existing `reduce(applyGPSPoint, …)` call sites were wrapped (`(w, r) => applyGPSPoint(w, r)`)
  because the new optional 3rd boolean param otherwise collides with `reduce`'s index arg.
- `getSecureStore` is intentionally mirrored from `ThemeContext` (no shared helper exists);
  not worth touching stable code to dedupe 5 lines.
