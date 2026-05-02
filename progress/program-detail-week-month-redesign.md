# Program Detail Redesign — Week/Month Tabs

Reworked `ProgramDetailScreen` to match the Aura Kinetic handoff design (`gritty-fitness-design-system/project/Program Detail.html`). Adds a monthly heatmap view, restructures the weekly view around an apex load chart + sport-colored timeline rows, and surfaces description/intensity/duration on every workout card so the prescribed plan reads at a glance.

## What changed

### Backend
- `ScheduledActivity` and `ScheduledActivityResponse` now carry `LinkedWorkoutID *string` (`json:"linked_workout_id,omitempty"`).
- `ProgramService.loadActivities` LEFT JOINs `workouts` on `scheduled_activity_id` so completion status is available client-side without a second roundtrip.
- Frontend `ScheduledActivityResponse.linked_workout_id?: string` mirrors the backend addition.

No new endpoint required — month view is built from the existing `getProgram` payload.

### Frontend — `activityIcons.ts`
- `getActivityColor(type)` — sport-family color map (run=teal, strength=purple, swim=blue, cycling=orange, mobility/yoga=green, recovery/rest=gray). Static across themes.
- `getIntensityLevel(prescription, activityType)` — derives 1–5 load level from `prescription.intensity` (numeric or descriptive), with sport-default fallbacks.
- `intensityLabel(level)` — human label for the level.
- `prescriptionPrimaryStats(prescription)` — duration / distance strings for row subtitles.
- `dominantActivity(activities)` — picks the highest-intensity activity (used by both apex chart and month cells).

### Frontend — `ProgramDetailScreen.tsx` (full rewrite)
- **Header card**: sport eyebrow · "WEEK X OF N" · program name · date range · progress bar · goal description. Progress = elapsed days / total days, falling back to current-week ratio if no end date.
- **Settings (kept)**: collapsible Program Settings row with criteria grid + edit modal.
- **Tab toggle**: underline tabs Week / Month, switching content below.
- **Week view**:
  - Phase eyebrow + chevron prev/next nav with "Week N · Apr 28 – May 4" label.
  - **Apex bar chart** card — bar per day, height = max intensity, color = dominant sport. Multi-workout days stack color slivers. Highlighted day is full opacity, others 33%. Today gets a primary dot below the day initial.
  - **Day timeline rows**: each day has an uppercase day eyebrow with date and a TODAY pill. Compact workout rows have a 3px sport-color left accent, sport-color icon circle, title, `duration · distance · intensity` line, and notes (italic, 2-line truncated). Status indicator: green ✓ for completed (linked_workout_id present), red ✕ for missed past dates, primary chevron for upcoming, sport-colored TODAY pill. Manual record play button shown for non-GPS activity types when not yet completed.
  - Dashed "Add another workout" button per day; rest-day card with inline `+ Add` pill.
  - Swipe left/right between weeks (existing pan responder retained); animated slide on chevron taps.
- **Month view**:
  - Calendar-month grid (6 rows × 7 cols, Mon-first) with prev/next month chevrons; navigation bounded to program start/end.
  - Each cell: date + sport icon, background = sport color × intensity-scaled opacity (`HEAT_OPACITIES = [0, 0.10, 0.22, 0.36, 0.56, 0.78]`). Today gets a 2px primary border. Completion dot top-right (success green if all day's activities completed, half-opacity if some).
  - Per-row average-intensity load bar on the left rail.
  - Tapping any in-program day jumps to Week view at that week and highlights the day.
  - Intensity legend (low → high) + monthly stats panel ("April Load") showing top two activity counts plus total km when distance is parseable.

### Status semantics
| State | Trigger |
|---|---|
| `completed` | `linked_workout_id` present |
| `today` | Date == today and not completed |
| `missed` | Date < today and not completed |
| `upcoming` | Date > today |

## Files touched

- `backend/internal/models/program.go` — add `LinkedWorkoutID` on schedule structs and `ToResponseWithDate`.
- `backend/internal/services/program.go` — `loadActivities` query.
- `frontend/src/services/api.ts` — `ScheduledActivityResponse.linked_workout_id`.
- `frontend/src/constants/activityIcons.ts` — color/intensity/dominant helpers.
- `frontend/src/screens/ProgramDetailScreen.tsx` — full rewrite.

## Deviations from the design

- **Manual-record play button** kept on rows for strength/mobility/drill/indoor types — design only shows status indicators, but our flow needs the entry point into RecordManual.
- **AddWorkoutSheet bottom sheet** not implemented; the "+ Add" / "Add another workout" buttons route directly to `ActivityDetail` so the user can fill in prescription/notes/intensity in one place (per user direction).
- **Settings (criteria) section** preserved above tabs (collapsed by default) — design has no equivalent but feature is needed.
- **Goal description** kept under the progress bar — design omits it, user asked to keep.
- **Delete program** stays in the navigation header (`headerRight` trash icon).
- Apex bar tap currently just sets day highlight; scrolling the timeline to that day is deferred (the screen-level ScrollView already shows everything).

## Validation

- `go build ./...` ✅
- `go test ./internal/services/... ./internal/models/...` ✅
- `golangci-lint run ./internal/services/... ./internal/models/...` ✅
- `tsc --noEmit` — no errors in changed files (pre-existing library typings unrelated to this change).
- code-simplifier pass extracted shared `dominantActivity` helper and removed redundant memos.
