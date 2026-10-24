# Workout timer, laps, live speed and post-finish analytics

Four related fixes to recorded workouts.

## A. One pause-aware workout timer

### Problem
The live timer, the active-workout banner, the summary "Time", the saved duration, the
history/detail screens and avg pace/speed could all show different durations for the same
workout. GPS manual pauses were tracked under "auto pause" fields, and laps/km splits
counted paused time.

### Root cause
Every screen worked out duration on its own: some used wall-clock `finished - started`,
some subtracted only auto-pauses, and history/detail ignored `paused_duration_sec`. Laps and
splits used raw point timestamps, so a pause inside a lap or km was counted as moving time.

### Fix
- `frontend/src/utils/workoutDuration.ts` is now the single source of truth:
  `activeElapsedSec`, `totalPausedSec` and `closePause` for live recordings, and
  `savedWorkoutDurationSec` for saved workouts (it mirrors the backend's
  `EffectiveDurationSec`).
- GPS pause fields renamed from `autoPausedDurationSec`/`lastAutoPauseStart` to
  `pausedDurationSec`/`lastPauseStart` (the same names the manual workout uses). Manual
  and auto pauses both count.
- The live GPS timer, banner, manual timer, summary, saved `paused_duration_sec`, avg
  pace/speed, History, LastWorkoutCard and WorkoutDetail all use the helpers.
  `formatDuration(seconds)` in `utils/dates.ts` replaces the timestamp-based version and
  ImportScreen's local copy.
- Laps and km splits exclude pauses. The GPS reducer stamps each point with
  `paused_before_sec` (pause time closed since the previous point), and
  `activeSecBetween()` subtracts it. The backend `computeKmSplitsFromPoints` does the same.
- Backend: `models.ActiveDurationSec` is shared by `EffectiveDurationSec` and the
  create handler. The PR history query in `review/records.go` now subtracts
  `paused_duration_sec`.
- Imports save the gap between the wall-clock span and the source's active duration as
  `paused_duration_sec`. TCX export writes active `TotalTimeSeconds`.
- Removed "Moving Time" (it is the same as Time now) and `auto_paused_duration_sec` from
  the route JSON. Summary avg pace/speed are now always whole-workout values, where some
  sports used to show the best lap.
- `RecordGPSScreen.commitGPSUpdate` writes `gpsWorkoutRef` synchronously before updating
  state. Pause, resume, stop, lap, cadence, HR readings and HR device name all go through
  it, so a location drain that runs before the next render can no longer write back a
  stale copy. `handlePause` does nothing unless the workout is recording, so an
  auto-pause that fired mid hold-to-pause keeps its start time.

## B. Laps only when the user pressed Lap

### Problem
Every GPS workout got automatic 1 km laps, which duplicated the per-km splits and buried
the laps the user actually pressed.

### Fix
- Auto-lap removed from the reducer (`AUTO_LAP_DISTANCE_M`, `lapStartDistanceM` deleted).
- `closeFinalLap(points, laps, lapStartIndex, hrReadings)` closes the stretch after the
  last Lap press into a final lap when the live workout is saved.
- `hasRecordedLaps` (≥2 laps) controls whether laps are shown on the summary, detail and
  import preview. A single lap just spans the whole workout.
- The empty-lap guard in `handleManualLap` requires at least one new point.
- `SplitsCard` shows the first 10 km with Show all / Show less.

## C. Live current speed/pace

### Problem
Current pace/speed used the last 10 or 5 points. Points are spaced by distance and can
arrive in background batches, so the window covered very different lengths of time and
the reading jumped around.

### Fix
`recentMovement()` in `gpsUtils.ts` uses a 15 s time window (`CURRENT_SPEED_WINDOW_MS`).
It never spans a gap over 20 s (pause or signal loss) and returns 0 for spans under 3 s.
`currentPaceSecPerKm`/`currentSpeedKph` share it.

## D. History analytics on the post-finish summary

### Problem
Effort, cardiac efficiency/drift, program alignment, PRs and weekly trend were only on
WorkoutDetail (History). The post-finish summary only had a local effort preview.

### Fix
- New `components/WorkoutAnalyticsSection.tsx` (fetch + render), with
  `utils/workoutAnalytics.ts#hasAnalyticsContent`. WorkoutDetailScreen uses it in place of
  its own copy.
- `PostWorkoutReview` renders it for every save flow and refetches after linking (via
  `refreshKey`) so program alignment appears. The pre-save effort preview on
  WorkoutSummary is hidden once saved.
- Premium-only endpoint. Free users see the locked card when the workout has GPS/HR data
  (`hasSensorData` prop).

## Key files
- Frontend: `utils/workoutDuration.ts`, `utils/workoutAnalytics.ts`,
  `components/WorkoutAnalyticsSection.tsx`, `services/gpsUtils.ts`,
  `services/gpsReducer.ts`, `services/workoutExport.ts`, `services/workoutFileParser.ts`,
  `contexts/WorkoutContext.tsx`, `types/gps.ts`, `utils/dates.ts`,
  `screens/RecordGPSScreen.tsx`, `screens/RecordManualScreen.tsx`,
  `screens/WorkoutSummaryScreen.tsx`, `screens/WorkoutDetailScreen.tsx`,
  `components/PostWorkoutReview.tsx`, `components/SplitsCard.tsx`,
  `components/ActiveWorkoutBanner.tsx`
- Backend: `models/workout.go`, `handlers/workout.go`, `review/deviation.go`,
  `review/records.go`
- Tests: `workoutDuration.test.ts`, `workoutAnalytics.test.ts`, `gpsUtils.test.ts`,
  `gpsReducer.test.ts`, `workoutExport.test.ts`, `workoutFileParser.test.ts`,
  `models/workout_test.go`, `review/deviation_test.go`

## Known limitations
- Strength/manual workouts have no post-save summary screen, so they get no analytics
  there. Their analytics are still on WorkoutDetail.
- Workouts saved before this change keep their stored 1 km auto-laps.
- The backend best-segment PR calculation still includes paused time. This can only make
  PRs slower, never falsely faster.
