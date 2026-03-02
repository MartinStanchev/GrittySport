## Bug Fixes: Task 8 Post-Implementation — Done
- **WorkoutContext** (`contexts/WorkoutContext.tsx`): Global workout state (ActiveWorkout, ExerciseLog, MobilityExerciseLog types) — moves all workout state out of RecordManualScreen so it persists across navigation
- **ActiveWorkoutBanner** (`components/ActiveWorkoutBanner.tsx`): Persistent banner at app top during recording — shows elapsed timer (derived from `startedAt`, accurate after nav away), taps to return via `navigationRef`
- **App.tsx**: Added `WorkoutProvider` + `navigationRef`, `ActiveWorkoutBanner` rendered above `BottomTabNavigator`
- **RecordManualScreen rewrite**: All workout state now from `WorkoutContext`; timer bar hidden during type-select phase (was shown twice redundantly); resumes existing workout on mount if context has one
- **HomeScreen scroll + FAB fix**: Wrapped header + comingUp in `ScrollView` to restore scrollability; FAB moved from `position: absolute` (floating too high) to inline `fabRow` View directly above chat bar, right-aligned
