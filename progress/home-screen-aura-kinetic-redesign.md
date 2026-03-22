# Home Screen Aura Kinetic Redesign

Redesigned the Home Screen based on Stitch Variant B design, using the Aura Kinetic design system (colors, fonts, glass-morphism).

## Changes

### New Components
- **`TodayWorkoutCard`** — Hero card showing today's planned workout from upcoming activities. Three states: no program (create CTA), rest day (moon icon), workout day (activity icon + prescription + START WORKOUT button).
- **`GritInsightCard`** — Compact card with Grit avatar, last assistant message (truncated 120 chars), "Chat with Grit" link. Replaces the old GritChatBanner fake-input field.
- **`QuickStatsRow`** — Two stat pills (workouts, streak) using themed colors.
- **`LastWorkoutCard`** — Compact row showing most recent workout with type, duration, relative date. Self-fetches via `getWorkouts({ limit: 1 })`.
- **`StreakDots`** — Mon-Sun dots showing which days had workouts this week. Computed from `getWorkouts` filtered to current week.
- **`BottomActionBar`** — Three-button bar (Start Workout, Log Activity, Chat with Grit). Chat button has unread count badge. Replaces the FAB + FABActionSheet.

### Modified Files
- **`HomeScreen.tsx`** — Complete layout rewrite:
  - Removed: `ProgramArc`, `GritChatBanner`, `ActivityDashboard`, `FABActionSheet`, FAB button
  - Added: `QuickStatsRow`, `TodayWorkoutCard`, `GritInsightCard`, `WeeklyEffortCounter`, `LastWorkoutCard`, `StreakDots`, `BottomActionBar`
  - Added `useWeeklyCompletedDays()` custom hook to compute workout days for the current week
  - Chat modal and all chat logic preserved unchanged
- **`WeeklyEffortCounter.tsx`** — Restyled with card layout (border + border radius), Aura Kinetic fonts
- **`QuickStatsRow.tsx`** — Simplified by code-simplifier: removed dead `monthlyHours`/`steps` props

### Deleted Files
- **`ActivityDashboard.tsx`** — Dead code after redesign, superseded by `LastWorkoutCard` + `TodayWorkoutCard`

### Shared Utilities
- **`utils/dates.ts`** — Added `formatRelativeDate` (extracted from LastWorkoutCard by code-simplifier)

## Layout Order (top to bottom)
1. Header ("GRITTY FITNESS")
2. QuickStatsRow (workouts, streak)
3. TodayWorkoutCard (hero)
4. GritInsightCard
5. WeeklyEffortCounter
6. LastWorkoutCard
7. StreakDots
8. BottomActionBar (sticky bottom: Start, Log, Chat)

## Key Decisions
- Steps and monthly hours removed from QuickStatsRow — no API data available yet, placeholder values were dead UI
- BottomActionBar replaces FAB entirely — provides direct access to Start Workout, Log Activity, and Chat
- Chat button in BottomActionBar includes unread badge from WebSocket hook
- Import file action not in BottomActionBar — accessible from History screen import button
- `useWeeklyCompletedDays` queries workouts for current week and maps JS day-of-week to Mon=0..Sun=6 index

## Verification
- 159 tests pass
- ESLint clean (0 errors, 0 warnings)
- Code simplifier run — extracted helpers, removed dead code
