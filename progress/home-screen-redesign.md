# Home Screen Redesign

## Summary
Redesigned the home screen to be the central hub of the app with a program progress arc, Grit chat banner, activity dashboard, and weekly effort counter.

## Key Changes

### New Components
- **`ProgramArc`** — SVG semi-circle arc showing program progress percentage, name, sport, week info. Uses `react-native-svg` Circle with strokeDasharray. No-program state shows create CTA.
- **`GritChatBanner`** — Shows last Grit message preview (2 lines), avatar with unread badge, mock input field. Tapping opens the full chat modal. Replaces the old floating bottom chat bar.
- **`ActivityDashboard`** — Two side-by-side cards: Last Workout (type, duration, date) and Next Activity (type, date, prescription). Both tappable to navigate to detail screens.
- **`WeeklyEffortCounter`** — Fetches weekly effort total from new API, shows progress bar toward goal (300 hardcoded, task-17 for configurability).
- **`useFetchOnFocus`** hook — Extracted shared pattern: fetch on mount + refetch on screen focus.

### HomeScreen Layout (top to bottom)
1. "GRITTY FITNESS" header
2. ProgramArc (centerpiece)
3. GritChatBanner (replaces floating chat bar)
4. ActivityDashboard (last workout + next activity)
5. WeeklyEffortCounter
6. FAB (absolute positioned, bottom-right)
7. Chat Modal (unchanged)

### Removed from HomeScreen
- Old program card with linear progress bar and "Log Workout" button
- "Coming up" section with full UpcomingActivityCard list
- Floating bottom bar (FAB row + chat bar)
- ~30 unused styles

### Backend: Effort Score Storage
- **Migration 014**: Added `effort_score SMALLINT` column to workouts table
- **Workout Create**: Computes TRIMP effort score from HR data on workout save (reuses `review.ComputeEffortScore`)
- **New endpoint**: `GET /api/v1/workouts/weekly-effort` — returns `total_effort`, `workout_count`, `goal`
- **getUserMaxHR helper**: Extracted duplicated max HR lookup pattern

### Frontend API
- Added `effort_score` to `WorkoutResponse`
- Added `WeeklyEffortResponse` interface and `getWeeklyEffort()` function

## Files Changed
- `db/migrations/014_add_effort_score.sql` (new)
- `backend/internal/models/workout.go`
- `backend/internal/services/workout.go`
- `backend/internal/handlers/workout.go`
- `backend/main.go`
- `frontend/src/services/api.ts`
- `frontend/src/screens/HomeScreen.tsx`
- `frontend/src/components/ProgramArc.tsx` (new)
- `frontend/src/components/GritChatBanner.tsx` (new)
- `frontend/src/components/ActivityDashboard.tsx` (new)
- `frontend/src/components/WeeklyEffortCounter.tsx` (new)
- `frontend/src/hooks/useFetchOnFocus.ts` (new)
- `tasks/task-17.md` (new — configurable effort goal)
