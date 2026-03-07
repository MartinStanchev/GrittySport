# Task 13: History Screen Improvements

## Summary
Enhanced the History screen with infinite scroll pagination, activity type filter chips, date range filtering, completion status indicators, and RPE display in strength sets.

## Changes

### Frontend

**`frontend/src/screens/HistoryScreen.tsx`** — Full rewrite
- Infinite scroll pagination: `PAGE_SIZE = 20`, `onEndReached` with `loadingMore` footer indicator
- Activity type filter chips (All, Run, Strength, Swim, Cycling, Drill, Mobility) in a horizontal ScrollView
- Date range filter button with modal picker (This Week, This Month, Last 30 Days, Last 90 Days, All Time)
- Completion status icons: green checkmark for met_targets/completed, yellow alert for below_targets
- Replaced `navigation.addListener('focus')` with `useFocusEffect` from React Navigation
- Shared `resetAndFetch` helper to deduplicate filter/date change handlers

**`frontend/src/screens/WorkoutDetailScreen.tsx`**
- Added RPE column to the StrengthDetail sets table (header + data rows)
- Extracted `formatDuration` and `formatFullDate` to shared `utils/dates.ts`

**`frontend/src/services/api.ts`**
- Added `completion_status` field to `WorkoutResponse` interface
- Added `start_date` and `end_date` params to `getWorkouts`
- Fixed falsy check bug: `params?.offset` → `params?.offset != null` (so offset=0 works)

**`frontend/src/utils/dates.ts`** — New shared module
- `formatDuration`, `formatShortDate`, `formatFullDate`, `formatDateRange`
- Deduplicated from HistoryScreen and WorkoutDetailScreen

### Backend

**`backend/internal/models/workout.go`**
- Added `CompletionStatus` field to `Workout` struct
- Added `WorkoutListFilter` struct with Limit, Offset, ActivityType, StartDate, EndDate

**`backend/internal/handlers/workout.go`**
- Parse `start_date` and `end_date` query params (YYYY-MM-DD format)
- Use `WorkoutListFilter` struct instead of individual params

**`backend/internal/services/workout.go`**
- `ListByUser` accepts `WorkoutListFilter`, builds date range WHERE clauses
- `populateCompletionStatus`: batch-fetches prescriptions for linked activities
- `evaluateCompletion`: compares recorded_data vs prescription (80% threshold)
  - No scheduled activity → "completed" (green)
  - >= 80% of prescription met → "met_targets" (green)
  - < 80% → "below_targets" (yellow)

## Key Files Changed
- `frontend/src/screens/HistoryScreen.tsx`
- `frontend/src/screens/WorkoutDetailScreen.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/utils/dates.ts` (new)
- `backend/internal/models/workout.go`
- `backend/internal/handlers/workout.go`
- `backend/internal/services/workout.go`
