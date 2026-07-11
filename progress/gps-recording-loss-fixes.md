# GPS Recording Loss Fixes (Triathlon Incident)

## Background

A real 5 km race recording (2026-07-05) lost its second half. Forensic analysis of the exported TCX against the code showed: two sub-kilometre laps that only the manual Lap button can create (09:36:44 and 09:38:47 UTC), then the point stream dying mid-stride at full running speed — the signature of accidental touches pressing Lap, Lap, then Pause. A manual pause never auto-resumes by design, so the rest of the race was silently discarded. The investigation also surfaced independent bugs in the TCX export and the auto-pause/resume path.

## Fixes

### 1. TCX export dropped the tail of the workout (`workoutExport.ts`)
- When stored laps exist, `renderTCXLaps` only emitted trackpoints inside stored lap ranges — everything after the last auto/manual lap was silently missing from exports.
- Now appends a synthetic tail lap covering `lastLap.endMs → finishedAtMs` whenever GPS points or HR readings exist after the last stored lap. No phantom lap when the last lap already ends at the final point.
- Boundary trackpoints (shared by adjacent laps via `triggerLap`'s `lapStartIndex = length - 1` convention) were emitted in both laps and double-counted ~5–10 m per lap. `renderTCXLap` now takes a `prevEndMs` cursor: first lap inclusive-start, later laps strictly-after the previous lap's end. Applies to GPS points and HR readings alike.

### 2. Auto-resume deadlock (`gpsReducer.ts`)
- The 50 m accuracy gate ran before the paused-state branch, so degraded GPS (> 50 m accuracy) could never reach `detectAutoResume` — an auto-paused workout stayed paused forever even while the user ran away.
- Paused handling now runs first with a lenient `RESUME_MAX_ACCURACY_METRES = 100` gate; the strict 50 m gate applies only to the recording path.
- Noise guard: a fix only counts toward resume when displacement exceeds `max(AUTO_RESUME_DISTANCE_M, fix.accuracy)`. Still requires 3 consecutive qualifying fixes. Manual pause semantics unchanged.
- Note: if the resuming fix itself is in the 50–100 m band, recording resumes but that point is excluded from the track; the next good fix reconnects the route.

### 3. Live lap distance double-count (`gpsUtils.ts`)
- `triggerLap` summed `distance_from_prev` including the boundary point (last point of the previous lap). Now sums `lapPoints.slice(1)` — a no-op for the first lap since `points[0].distance_from_prev === 0`.

### 4. Screen unmount killed background GPS mid-workout (`RecordGPSScreen.tsx`)
- The mount-effect cleanup unconditionally called `locationTracking.stop()` + `cadenceService.stop()` on unmount, permanently killing tracking if the user navigated away mid-recording (nothing ever restarted it). Cleanup now checks `gpsWorkoutRef` at unmount time and only stops when no workout is in `recording`/`paused` state.
- Self-heal: `useFocusEffect` verifies `locationTracking.isRunning()` when the screen is focused while recording, restarting it if the OS (or the old bug) killed it.

### 5. Hold-to-activate on live controls (`RecordGPSScreen.tsx`)
- Lap / Pause / Finish / Discard now require a ~600 ms long-press (`HOLD_TO_ACTIVATE_DELAY_MS`); a short tap shows a toast hint ("Hold to pause" etc.). Resume stays a plain tap. Existing Finish/Discard confirmation alerts remain as a second barrier.
- `ControlButton` extended with `variant: 'compact' | 'primary'` (the primary pill absorbs the previously hand-rolled Pause/Resume Pressables), `holdToActivate`, `hintText`, and press-scale feedback via `Animated.createAnimatedComponent(Pressable)`.

### 6. Pause notification (`hooks/usePauseNotification.ts`, new; mounted in `WorkoutContext.tsx`)
- Watches `recordingState`: on transition to `paused` (manual or auto), presents an immediate local notification ("Workout paused — distance is not being tracked…", body differs for auto vs manual); dismissed on resume/finish/discard. Permission is checked, never requested. Relies on the background location task keeping JS alive so backgrounded auto-pauses are observed.
- Mounted in `WorkoutProvider`, not the recording screen — tracking keeps running when the user navigates away mid-workout (fix 4), so the notification must outlive the screen too.

## Verification
- Full frontend suite: 268/268 tests passing (15 suites), including new tests: 5 TCX lap-boundary/tail tests (`workoutExport.test.ts`), 5 resume-accuracy tests (`gpsReducer.test.ts`), 2 lap-distance tests (`gpsUtils.test.ts`).
- ESLint clean on all changed files; `tsc --noEmit` clean for changed files (pre-existing unrelated errors remain in `LiveHRChart.tsx`, `WorkoutCharts.tsx`, `useNotifications.ts`).
- Code simplifier pass run over the whole change set.

## Key files
- `frontend/src/services/workoutExport.ts`
- `frontend/src/services/gpsReducer.ts`
- `frontend/src/services/gpsUtils.ts`
- `frontend/src/screens/RecordGPSScreen.tsx`
- `frontend/src/contexts/WorkoutContext.tsx` (mounts the pause-notification hook)
- `frontend/src/hooks/usePauseNotification.ts` (new)
- `frontend/src/__tests__/{workoutExport,gpsReducer,gpsUtils}.test.ts`

## Not done (deliberately)
- No auto-resume for *manual* pauses — the notification covers the accidental-pause case without changing intentional-pause semantics.
- TCX export still writes stored `lap.distance_m` in lap headers as recorded (historical workouts keep their stored double-count; only trackpoint emission and new recordings are corrected).
- Future refactor candidate: drive `locationTracking` start/stop from workout lifecycle transitions in `WorkoutContext` instead of screen mount/unmount — the screen-level unmount guard + focus self-heal would then be unnecessary. Deferred as a scope change.
