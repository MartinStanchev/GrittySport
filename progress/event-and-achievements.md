# Goal Events + Achievements (Trophy Room)

Adds a first-class "goal event" concept to programs (the race/meet/competition a program builds toward) and a durable achievements/trophy-room system that auto-mints accomplishments from recorded workouts and lets users pin their own.

## Decisions

- **Event = a scheduled activity of type `event`**, not a parallel concept. It reuses the entire `scheduled_activities → workout link → review` pipeline (calendar rendering, linking, post-workout review). Rich fields (`event_name`, `event_subtype`, `location`, `goal`, `distance`, plus the absolute `date`) live in the activity `prescription` JSONB — no schema change needed for the event itself. The event is placed on the program's **final week**, and the program `end_date` is aligned to the event date.
- **Dedicated `set_program_event` tool** (not folded into `edit_program`) because events are singular and edited independently ("my race moved"). It is idempotent — re-calling updates the single existing event.
- **Achievements are stored** (not derived on the fly) so event finishes and the moment are captured permanently and manual pins are possible. A `dedupe_key` UNIQUE per user makes minting idempotent, so the evaluator runs safely on every workout save and link.
- **Auto-mint everything** (chosen "everything at once"): event completion, personal records (reuses existing `review.DetectPersonalRecords`), and cumulative milestones (workout count + total distance). Plus manual pins.
- **Event completion fires a celebratory Grit review** by prepending an `eventCelebrationPreamble` to the review prompt when the linked activity is an `event`.
- **Trophy room lives off the tab bar**: a header trophy icon + a Home highlight card route into a new `AchievementsScreen` pushed on the Home stack.
- **Premium gating**: auto-minted trophies (events/PRs/milestones) are free for everyone; pinning your own workouts is Premium (UI gate via existing `isPremium`).

## Backend

- **`db/migrations/032_achievements.sql`** — `achievements` table (`type`, `title`, `subtitle`, `workout_id` FK CASCADE, `program_id` FK SET NULL, `activity_type`, `metric_value/unit`, `dedupe_key`, `achieved_at`), `UNIQUE(user_id, dedupe_key)`, index on `(user_id, achieved_at DESC)`.
- **`internal/models/achievement.go`** — `Achievement` model + type constants.
- **`internal/achievements/service.go`** — `Evaluate` (event completion + PRs + milestones), `List`, `CreateManual` (pin), `Delete`. `candidate` struct + idempotent `insert` (`ON CONFLICT DO NOTHING`). Milestone helper `highestCrossed`; total distance summed via a regex-guarded JSONB cast (`distance_km` / `distance_m`).
- **`internal/handlers/achievement.go`** — `GET/POST/DELETE /api/v1/achievements`.
- **`internal/handlers/workout.go`** — `evaluateAchievements` (background goroutine) called after `Create` and `Link` so PRs/milestones mint on save and event-completion mints once linked.
- **`internal/tools/tools.go`** — added `"event"` to `ActivityTypes`, `stringParam` helper, and the `set_program_event` tool (ModeProgramManagement).
- **`internal/services/program.go`** — `SetProgramEvent`: upserts the single `event` activity into the last week, stores prescription, aligns `end_date`; transactional + ownership-checked.
- **`internal/review/service.go`** — `isEventActivity` + `eventCelebrationPreamble` branch in `TriggerReview`.
- **`prompts/system_program_modify.md`** — "Goal event" guidance steering Grit to `set_program_event`.
- **`main.go`** — wired achievements service/handler + routes; injected into the workout handler.

## Frontend

- **`src/services/api.ts`** — `Achievement`/`AchievementType` types + `getAchievements` / `pinAchievement` / `deleteAchievement`.
- **`src/constants/activityIcons.ts`** — `event` added to `ACTIVITY_TYPES`, icon (`trophy-outline`), display name, sport color, and exported `EVENT_COLOR` (gold `#E8B53C`).
- **`src/utils/achievements.ts`** — per-type icon/label/color + `groupAchievementsByMonth`.
- **`src/utils/programEvent.ts`** — `findProgramEvent` (scans phases→weeks→activities for `event`) + `countdownLabel`.
- **`src/components/AchievementCard.tsx`** — row card with type eyebrow, share (`Share.share`), optional delete.
- **`src/components/AchievementsHighlightCard.tsx`** — Home card: latest trophy + count, hidden until ≥1 earned.
- **`src/components/EventCountdownCard.tsx`** — fetches program detail by id (cached), shows the event + countdown; null when no event.
- **`src/screens/AchievementsScreen.tsx`** — Trophy Room: month-grouped `SectionList`, pull-to-refresh, empty state, tap → WorkoutDetail, delete with confirm.
- **`src/navigation/HomeStackNavigator.tsx`** — registered `Achievements` ("Trophy Room").
- **`src/screens/HomeScreen.tsx`** — header trophy button → Achievements, `EventCountdownCard`, `AchievementsHighlightCard`.
- **`src/screens/ProgramDetailScreen.tsx`** — `EventCountdownCard` under the header.
- **`src/screens/WorkoutDetailScreen.tsx`** — "Pin to Trophy Room" button (Premium-gated) via `pinAchievement`.

## Tests / validation

- New: `backend/internal/achievements/service_test.go` (`highestCrossed`, `prescriptionString`); `frontend/src/__tests__/programEvent.test.ts` (`findProgramEvent`, `countdownLabel`).
- `go build ./...` clean; `golangci-lint run` clean; Go unit tests pass.
- `npx jest` — 256 pass (251 prior + 5 new); `npx tsc --noEmit` introduces no new errors (only pre-existing chart/notification errors remain); `eslint` clean on changed files.
- code-simplifier run — no changes needed; flagged + fixed two files (`tools.go`, `HomeScreen.tsx`) that had flipped LF→CRLF, normalized back to LF for clean diffs.

## Follow-ups (deferred)

- Branded/shareable achievement image cards (currently text share).
- Weekly-effort-goal milestone type.
- Surfacing event completion achievement inline on ProgramDetail ("View achievement").
