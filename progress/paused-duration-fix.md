# Paused-duration fix — workout duration excludes paused time

## Problem
When a user paused a recording, the on-screen elapsed timer froze (correct), but the
saved/derived duration did not. The frontend timer subtracts paused time, while the
backend computed duration purely as wall-clock `finished_at - started_at`. Result: a
workout shown as 24:55 while recording was stored/reviewed as ~26:00. The same wrong
(longer) figure was what Grit received in its post-workout review prompt.

## Root cause
- Frontend correctly tracks paused time (`pausedDurationSec` for manual,
  `autoPausedDurationSec` for GPS) and subtracts it from the displayed timer, but only
  sent `started_at`/`finished_at` to the backend — paused time was never persisted.
- Backend recomputed duration as `FinishedAt.Sub(StartedAt)` in ~7 places (effort score,
  deviation, PR detection, achievements, review prompt text, segment header), all
  ignoring pauses.

## Fix
Persist paused seconds on the workout and subtract it everywhere duration is derived.

- **DB**: `db/migrations/033_workout_paused_duration.sql` adds
  `workouts.paused_duration_sec DOUBLE PRECISION NOT NULL DEFAULT 0`.
- **Model**: `Workout.PausedDurationSec` + `SaveWorkoutInput.PausedDurationSec`, plus a
  single `Workout.EffectiveDurationSec()` helper = `finished-started-paused` (0 when no
  finish or negative). All duration call-sites now use this helper.
- **Backend call-sites updated**: `handlers/workout.go` (effort score),
  `review/service.go` (effort, generic deviation, review prompt "Duration: N minutes"),
  `review/analytics.go` (effort + duration deviation), `review/records.go` (swim PR
  pace), `achievements/service.go` (effort for PR minting).
- **Service**: `paused_duration_sec` threaded into `workoutColumns`, scan, and INSERT.
- **Frontend**: both save flows send `paused_duration_sec` —
  `WorkoutSummaryScreen` (GPS → `autoPausedDurationSec`),
  `RecordManualScreen` (manual → `pausedDurationSec`); added to `SaveWorkoutInput`.
- **Offline queue**: field carried through `offlineStorageTypes`, the SQLite schema +
  `migratePendingWorkouts` ADD COLUMN, save/select, and `syncService` save+replay, so
  queued workouts keep the correct duration after sync.

GPS `gps_route.duration_sec` already excluded pauses; the backend now agrees with it.

## Key files
- `db/migrations/033_workout_paused_duration.sql`
- `backend/internal/models/workout.go`
- `backend/internal/services/workout.go`
- `backend/internal/handlers/workout.go`
- `backend/internal/review/{service,analytics,records}.go`
- `backend/internal/achievements/service.go`
- `frontend/src/services/{api,syncService,offlineStorage.native,offlineStorageTypes}.ts`
- `frontend/src/screens/{WorkoutSummaryScreen,RecordManualScreen}.tsx`
