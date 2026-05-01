# Linkable Activity Window

## Summary
Replaced the "upcoming activities" lookup used in workout-to-program linking with a dedicated `/api/v1/activities/linkable` endpoint that returns scheduled activities within a ±3 day window of a reference date, excludes activities already linked to a workout, and ranks them with same-type matches first, then by date priority `[-1, -2, -3, today, +1, +2, +3]` (past days preferred).

## Problem
The link UIs in `PostWorkoutReview` and `WorkoutDetailScreen` both called `/api/v1/activities/upcoming`, which only returned activities from today onward. A workout finished in the morning could not be linked to yesterday's missed run, and an old workout opened from history saw no candidates at all because the window started "today."

The frontend also did substring-based type matching (`run` ⊂ `running`), which became dead weight after the activity-type canonicalization collapsed sub-flavors into single canonical types.

## Solution

### Backend
- New service method `ProgramService.GetLinkableActivities(userID, activityType, refDate, windowDays)`:
  - Joins `workouts` to filter out already-linked scheduled activities (`LEFT JOIN ... WHERE wo.id IS NULL`).
  - Computes activity dates the same way as `GetUpcomingActivities` (Monday of week + day-of-week offset).
  - Applies `[refDate - windowDays, refDate + windowDays]` window.
  - Sorts by `(SameType desc, datePriority asc, OrderIndex asc)` where the priority function maps offsets to: -1→0, -2→1, -3→2, today→windowDays, +1→windowDays+1, etc.
- Sort logic extracted into `SortLinkableCandidates` + `linkableDatePriority` so it's unit-testable without a DB.
- New handler `GetLinkable`: parses `activity_type` (required), optional `reference_date` (YYYY-MM-DD), optional `window_days` (1-14, default 3).
- Route: `GET /api/v1/activities/linkable`.
- Response model `LinkableActivityResponse` embeds `UpcomingActivityResponse` and adds `same_type bool`.

### Frontend
- `getLinkableActivities(activityType, { referenceDate?, windowDays? })` in `services/api.ts`.
- New `formatRelativeDay(dateStr, reference?)` util — handles past *and* future ("Yesterday", "Today", "Tomorrow", "In 3 days", "3 days ago").
- `PostWorkoutReview`: uses the new endpoint; client-side substring filter removed; date label is now `formatRelativeDay(a.date)`.
- `WorkoutDetailScreen.handleLinkToProgram`: passes `referenceDate = workout.started_at` so old workouts see candidates from their own week, not today's.

### Tests
- Unit test `program_linkable_test.go` covers priority math, the same-type-first / past-first ordering, and order_index tiebreaker.
- `auth_test.go::TestMain` updated: `m.Run()` now runs even without `TEST_DATABASE_URL`, and `cleanTables` skips the test when `testPool` is nil. Without this fix, the previous `os.Exit(0)` short-circuit silently skipped *all* tests in the `services` package directory, masking pure-logic test failures.

## Key Files Changed
- `backend/internal/models/program.go` — added `LinkableActivityResponse`
- `backend/internal/services/program.go` — added `GetLinkableActivities`, `LinkableCandidate`, `SortLinkableCandidates`, `linkableDatePriority`
- `backend/internal/services/program_linkable_test.go` — new (unit tests)
- `backend/internal/services/auth_test.go` — TestMain runs without DB; `cleanTables` skips
- `backend/internal/handlers/program.go` — new `GetLinkable` handler
- `backend/main.go` — registered route
- `frontend/src/services/api.ts` — `LinkableActivity`, `LinkableActivityOpts`, `getLinkableActivities`
- `frontend/src/utils/dates.ts` — `formatRelativeDay`
- `frontend/src/components/PostWorkoutReview.tsx` — new endpoint, dropped substring filter
- `frontend/src/screens/WorkoutDetailScreen.tsx` — new endpoint with workout date as reference
