# Manual Workout Pause/Resume

## Changes

### Pause state on manual workouts
- Added `pausedDurationSec: number` and `lastPauseStart: number | null` to `ActiveWorkout` in `WorkoutContext`, mirroring the GPS workout pause pattern.
- Initialized both in `startWorkout` and added them to `ManualWorkoutInitFields`.

### Pause/Resume UI in the timer bar
- New circular Pause/Resume button placed between the HR pill and the Finish button in the recording timer bar (`RecordManualScreen`).
- The `ELAPSED` label flips to `PAUSED` and dims the timer value while paused.
- `handlePause` records `lastPauseStart`; `handleResume` rolls the elapsed pause into `pausedDurationSec` and clears the timestamp.
- `handleFinishWorkout` flushes any in-progress pause into the total before transitioning to the summary screen so the saved elapsed time is correct.

### Frozen-while-paused side effects
- The elapsed timer freezes while paused and resumes seamlessly afterwards — formula subtracts both the accumulated `pausedDurationSec` and the current pause delta.
- Mobility per-exercise countdown timers are gated on `lastPauseStart == null`.
- HR-driven set detection (`useSetDetection`) is gated on `lastPauseStart == null` so resting HR drift can't fire spurious next-set highlights.
- Summary phase elapsed (when `phase === 'summary'`) subtracts `pausedDurationSec` from `finishedAt - startedAt`.

### Mini banner
- `ActiveWorkoutBanner` manual branch uses the same pause-aware elapsed formula and dims the pulsing dot when paused, matching the existing GPS banner behavior.

## Key Files
- `frontend/src/contexts/WorkoutContext.tsx`
- `frontend/src/screens/RecordManualScreen.tsx`
- `frontend/src/components/ActiveWorkoutBanner.tsx`

## Validation
- `tsc --noEmit`: no new errors in changed files (pre-existing chart/notification errors unchanged).
