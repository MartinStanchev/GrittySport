# Program Detail — Calendar/Apex/Legend Follow-ups

Three follow-up tweaks on top of `program-detail-week-month-redesign.md` to clean up dead-end interactions and a misleading legend.

## What changed

All in `frontend/src/screens/ProgramDetailScreen.tsx`.

### 1. Calendar cell tap → activity detail (when unambiguous)

Tapping a day in the Month view used to always jump to the Week view (without scrolling to the right day, so it was effectively a no-op for users who could already see that week). Now:

- Single-activity day → navigate directly to `ActivityDetail` for that activity.
- Multi-activity day → fall back to `jumpToDate` (week-view jump + day highlight).
- Out-of-program / out-of-month days remain non-interactive.

Implemented as a new `handleMonthCellPress(date, activities)` callback in the parent. `MonthView`'s prop renamed `onDayPress: (d: Date) => void` → `onCellPress: (d: Date, activities: ScheduledActivityResponse[]) => void`. The `MonthCell` render hoists `acts` to a local so it isn't computed twice.

### 2. Apex chart no longer interactive

The "Load this week" bar chart used to be tappable, but tapping only changed the in-view day highlight — there was no scroll target, so the only visible effect was a font-weight change deep in the timeline. Removed the `Pressable` wrapper (replaced with a plain `View`) and dropped the `onSelectDay` prop from `ApexBarChart`. The `highlightDayIdx` prop stays — it's still driven by the calendar→week jump and the initial-load effect.

### 3. Removed Low/High intensity legend

The legend used a single-color ramp (run teal × 5 opacities), but month cells are colored per-sport and the left-rail bar uses `colors.primary` as a fill — the legend's gradient corresponded to nothing visible in the grid. Deleted the legend JSX block and its three styles (`legendRow`, `legendText`, `legendCell`).

## Files touched

- `frontend/src/screens/ProgramDetailScreen.tsx` — handler + prop signature, ApexBarChart Pressable→View, legend deletion.

## Validation

- `tsc --noEmit` — no errors in changed file (unrelated pre-existing errors in `LiveHRChart`, `WorkoutCharts`, `useNotifications` only).
- `eslint` — 0 errors on the changed file (2 pre-existing `react-hooks/exhaustive-deps` warnings on `monthStart`/`monthEnd` unchanged).
