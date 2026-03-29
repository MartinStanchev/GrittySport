# Daily Schedule — Multi-Activity Support

## Summary
Redesigned the home screen's "Today's Workout" card into a "Daily Schedule" section that supports multiple activities per day, with completion tracking and automatic promotion.

## Changes

### HomeScreen (`frontend/src/screens/HomeScreen.tsx`)
- Changed `todayActivity` (single `.find()`) to `todayActivities` (`.filter()`) to collect all activities for today
- Added `completedActivityIds` state: fetches today's workouts via `getWorkouts()` and builds a `Set<string>` of `scheduled_activity_id`s that have been completed
- Updated `TodayWorkoutCard` props from single `activity` to `activities` array + `completedIds` set

### TodayWorkoutCard (`frontend/src/components/TodayWorkoutCard.tsx`)
- **DAILY SCHEDULE header**: Section title with phase/week context on the right
- **Hero card**: Shows first uncompleted activity with "WORKOUT N" badge (when multiple), activity name, prescription summary, and "START SESSION" button
- **Compact "NEXT UP" rows**: Remaining uncompleted activities shown as compact rows with activity icon, name, prescription, and chevron
- **Compact "COMPLETED" rows**: Finished activities shown with green checkmark icon, "COMPLETED" label, and dimmed name
- **"ALL DONE" state**: When all activities are completed, hero card shows a celebratory message
- **Rest day state**: Unchanged — shows moon icon and rest message when no activities scheduled
- **Auto-promotion**: When the first workout is completed, the next uncompleted one automatically promotes to hero position, and the completed one drops to a compact row below

### Key Design Decisions
- No backend changes needed — `getWorkouts` already returns `scheduled_activity_id` and `/api/v1/activities/upcoming` already returns multiple activities per day sorted by `order_index`
- Completion detection uses `scheduled_activity_id` matching between workouts and scheduled activities
- Extracted `CompactActivityRow` as a private component with its own props interface

## Key Files Changed
- `frontend/src/screens/HomeScreen.tsx`
- `frontend/src/components/TodayWorkoutCard.tsx`
