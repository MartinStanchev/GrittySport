# Task 17: Configurable Weekly Effort Goal

## Summary
Made the weekly effort goal user-configurable (via Settings) and Grit-configurable (via tool call), replacing the hardcoded value of 300.

## Changes

### Database
- `db/migrations/015_add_weekly_effort_goal.sql` — adds `weekly_effort_goal INTEGER NOT NULL DEFAULT 300` to `users`

### Backend
- `backend/internal/models/user.go` — added `WeeklyEffortGoal int` to `User` and `UserResponse` structs
- `backend/internal/services/user.go` — added `WeeklyEffortGoal *int` to `UpdateUserInput`, updated `GetByID` and `Update` queries
- `backend/internal/handlers/workout.go` — `WeeklyEffort()` now reads goal from `users` table via scalar subquery instead of hardcoding 300
- `backend/internal/tools/tools.go` — registered `set_weekly_effort_goal` tool so Grit can adjust the goal when creating/modifying programs

### Frontend
- `frontend/src/services/api.ts` — added `weekly_effort_goal` to `UserResponse` and `UpdateUserInput`
- `frontend/src/screens/SettingsScreen.tsx` — added "Training" section with Weekly Effort Goal numeric input, extracted `DEFAULT_MAX_HR` and `DEFAULT_EFFORT_GOAL` constants

## Verification
- `go build ./...` — passes
- `golangci-lint run` — passes
- `go test ./...` — passes
- `npx jest` — 159 tests pass
