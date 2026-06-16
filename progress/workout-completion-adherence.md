# Workout Completion / Plan Adherence

Adds a "done vs skipped" completion metric (Apple-Fitness-rings idea, but rendered
as a flat 3-segment progress bar rather than rings) so users can see how well they
are keeping up with their training plan.

## What changed

### New shared logic — `frontend/src/utils/adherence.ts`
- `AdherenceCounts` type: `{ done, skipped, upcoming, total }`.
- `computeAdherence(activities, now?)` tallies scheduled activities:
  - **done** = `linked_workout_id` present (a workout is linked).
  - **skipped** = unlinked **and** date is before today (missed = skipped, per user decision).
  - **upcoming** = unlinked and today/future.
  - **Passive types excluded** (`rest`, `recovery`, `mobility`, `yoga`) — mirrors backend `notifications.PassiveActivityTypes`, so rest days never count as skipped and tank the number.

### New component — `frontend/src/components/AdherenceBar.tsx`
- Card matching `WeeklyEffortCounter` styling (surface bg, border, radius 16).
- Header row: icon + title + `done/total` headline.
- 3-segment bar via flex weights: done (success/green) | skipped (error/red) | to-go (track shows through). Zero-count segments are not rendered.
- Legend row with colored dots: Done / Skipped / To go (skipped & to-go hidden when zero).
- Renders nothing when `total === 0`.

### Program Detail — `frontend/src/screens/ProgramDetailScreen.tsx`
- New `adherence` memo over **all** program activities → `<AdherenceBar title="Plan adherence" />` placed directly below the header card (the header's existing bar is *calendar time*; this is *sessions*).

### Home — `frontend/src/screens/HomeScreen.tsx`
- `useCurrentWeekAdherence(programId)` hook: fetches the active program detail on focus, filters activities to the current Mon–Sun week, runs `computeAdherence`.
- Compact `<AdherenceBar title="This week" icon="calendar-outline" />` rendered after `WeeklyEffortCounter`, only when there is an active program (the hook returns `null` otherwise).

### Tests — `frontend/src/__tests__/adherence.test.ts`
- 6 cases: empty, linked-as-done (any date), past-unlinked-skipped, today/future-upcoming, passive exclusion, combined total.

## Code-simplifier pass
- Consolidated duplicated date helpers (`startOfDay`, `addDays`, `sameDay`) into `frontend/src/utils/dates.ts` and added `mondayOf` there.
- `adherence.ts`, `ProgramDetailScreen.tsx`, and `HomeScreen.tsx` (incl. the pre-existing `useWeeklyCompletedDays` hook) now import these from `dates.ts` instead of redefining them.
- `ProgramDetailScreen`'s `activityStatus` (4-state UI status) left intact — a different concern from the 3-bucket tally.

## Design decisions
- **Both screens** (program-wide on Program Detail, this-week on Home) so they complement rather than duplicate; Home stays focused on "today/this week".
- **Segmented bar over arc/rings** — an arc cleanly shows only one ratio; the 3-state bar shows done/skipped/to-go at a glance and matches the app's existing flat progress bars.
- **No new backend endpoint** — `linked_workout_id` already ships on scheduled activities (`getProgram`).

## Validation
- `tsc --noEmit` — clean for changed files.
- `eslint` — clean (0 errors/warnings) on all touched files.
- `jest src/__tests__/adherence.test.ts` — 6/6 pass.

## Follow-up: removed "This week" AdherenceBar from Home
The `<AdherenceBar title="This week">` overlapped with the existing `StreakDots`
("This Week" day-with-ticks) on Home, so it was removed. Dropped the
`useCurrentWeekAdherence` hook and now-unused `getProgramCached`/`addDays`/
`AdherenceBar`/`computeAdherence` imports from `HomeScreen.tsx`. `AdherenceBar`
stays in use on Program Detail (program-wide "Plan adherence").
