# Link to Activity Before Post-Workout Review

## Summary
Moved the "link to scheduled activity" step into the PostWorkoutReview component so it happens **before** Grit's review is triggered. This ensures Grit always has the correct alignment context when reviewing a workout.

## Problem
Previously, the post-workout review was triggered immediately and asynchronously when a workout was saved. If the workout wasn't linked to a scheduled activity at save time, Grit's review missed the alignment/deviation analysis entirely. The only way to link after the fact was from WorkoutDetailScreen, but the review had already been generated without that context.

## Solution
- **Backend**: Removed auto-trigger of review from the `Create` workout handler. Added a new `POST /api/v1/workouts/{workoutId}/review/trigger` endpoint that the frontend calls after the user decides whether to link.
- **Frontend**: Enhanced `PostWorkoutReview` component with a new `linking` phase before polling:
  1. On mount, fetches upcoming compatible activities (same activity type)
  2. If compatible activities exist, shows radio-button link UI + skip option
  3. If no program or no compatible activities, auto-skips
  4. After link/skip, calls trigger endpoint, then polls as before
- **ImportScreen**: Removed the duplicate link UI (was in the import bottom sheet). PostWorkoutReview now handles it uniformly across all flows.

## Flow
```
Save → [Link to activity? / Skip] → Trigger review → "Grit is reviewing..." → Review ready
```

## Key Files Changed
- `backend/internal/handlers/workout.go` — new `TriggerReview` handler, removed auto-trigger from `Create`
- `backend/main.go` — registered `POST /workouts/{workoutId}/review/trigger` route
- `frontend/src/components/PostWorkoutReview.tsx` — major rewrite with linking phase, `LoadingPanel` helper
- `frontend/src/services/api.ts` — added `triggerWorkoutReview()`
- `frontend/src/screens/WorkoutSummaryScreen.tsx` — pass `activityType` + `scheduledActivityId` props
- `frontend/src/screens/WorkoutFilePreviewScreen.tsx` — pass `activityType` + `scheduledActivityId` props
- `frontend/src/screens/LogActivityScreen.tsx` — pass `activityType` prop
- `frontend/src/screens/ImportScreen.tsx` — removed link UI, simplified import flow, pass `activityType` prop
