# Progressive Overload

Grit can now plan load that grows week by week inside a phase (e.g. "+10%/week long run for 12 weeks") with built-in deload weeks. It replaces identical copy-pasted template weeks with a recurring **activity series** per template activity, materialized into one scheduled activity per week.

## Numeric prescriptions (prerequisite)
- Prescriptions now store measurable values as numbers in metric base units: `distance_m`, `total_distance_m`, `duration_sec`, `pace_sec_per_km`, `pace_sec_per_100m`, `power_w`, `weight_kg`, `rest_sec`, `reps`, `rpe` (1–10); `sets` is an array at top level and a count inside `exercises`.
- `models.ValidatePrescription` rejects the old string keys (`distance`, `pace`, `duration`, `weight`, `total_distance`, `time`, `rest_seconds`) with a hint. Event prescriptions (race metadata) are exempt.
- Fixes analytics/completion that silently read nothing: the old readers expected `distance_km` / `target_pace_sec_per_km` / `duration_minutes`, which no prompt ever produced, and `"85kg"` parsed to 0. `review/deviation.go`, `review/analytics.go` and `services/workout.go` `evaluateCompletion` now use `PrescribedDistanceM` / `PrescribedDurationSec` / `RecordedDistanceM`.
- Display is metric-only for now (workout screens are metric-only); the units preference only affects body metrics.

## Progression rules + deloads (`models/progression.go`)
- `ProgressionRule{field, exercise?, set_index?, percent | step, max?, round?}`. Fields: `distance_m`, `duration_sec`, `reps`, `sets`, `weight_kg`. Percent compounds (≤15%/wk); step limits per field (5 km, 30 min, 5 reps, 2 sets, 20 kg). Default rounding: 100 m, 60 s, 1, 1, 0.5 kg; `max` caps.
- Phase `PhaseLoad{deload_weeks (1-based), deload_pct (10–60)}`. `TemplatePhaseInput.Prepare()` normalizes (default 35% when deload weeks exist, 0 otherwise) and validates, so stored/displayed values are always real.
- Deload cuts volume (distance, duration, interval reps / single-block length, exercise sets) and keeps intensity (pace, power, weight). Passive types and `event` are exempt.
- Steps = non-deload weeks in `[baseWeek, week)`: a deload week cuts from the level it reaches; the next week repeats that level uncut and the ramp continues.
- `total_distance_m` follows interval-volume growth.
- `BuildPhasePreview` → weekly totals + per-rule weekly values; `TemplatePhaseInput.ProgressionSummary()` renders them for the LLM (`week_by_week` in `save_draft_phase` / `update_draft_phase` results) so Grit can check its numbers.

## Activity series (`db/migrations/035_progressive_overload.sql`, `services/program_series.go`)
- `activity_series` (phase, day, type, base prescription, notes, order, progression, `base_week`); `scheduled_activities.series_id` + `is_override`; phases get `deload_weeks` / `deload_pct`.
- Saving a program (`insertTemplatePhases`) creates series + weeks + materialized instances, batched per phase (4 round trips: phase, series, weeks, activities).
- Series edits (`edit_program` `update_activity` / `add_activity` / `remove_activity` / `swap_day` by day) touch only **open** instances: dated today or later, no linked workout, not overridden. History stays intact.
- A new prescription or progression rebases the series to its first open week, carrying the progressed level forward (`ProgressedPrescription`), then rewrites open instances with one `UPDATE … FROM unnest(...)`.
- Editing a single instance (by ID, or the user's manual edit) sets `is_override`; overridden instances don't expose series progression.
- `edit_program` accepts `progression` on day-based `update_activity` / `add_activity` (`ProgramEdit.ValidatePayload`). Grit's progression changes go through the normal edit approval card.

## Validation in one place
- `SaveProgramWithCriteria` calls `TemplateProgramInput.Prepare()`; single-activity writes (`CreateActivity`, `UpdateActivity`, edit by ID, single-week add) and series writes validate in the service with the effective activity type. Failures wrap `services.ErrInvalidInput`, which handlers map to 400.

## Proposal preview + UI
- The `program_proposal` WS frame is `models.NewProposalView(program)`: the program plus `phase_previews` (`weeks[]` load + `activities[i][j]` = weekly values of rule j of activity i). Built at send time so it always matches the current proposal.
- `ProposalReviewView`: `WeeklyLoadBars` mini chart (deload weeks in accent), deload line, prescription summary per activity, and rule ranges ("10 km → 13.3 km · +10%/wk").
- Program Detail: "DELOAD WEEK" pill on deload weeks, trending-up progression line on activity rows (`is_deload`, `progression` from the API).
- `PrescriptionEditor` rewritten around unit-aware `NumberField`s (km / min / mm:ss pace / kg / s) that store base units; `PrescriptionDisplay` formats via the same registry.
- `utils/prescription.ts`: formatters, summaries, `PRESCRIPTION_FIELDS` registry (format + editor codec per canonical key), `INPUT_CODECS`, `withField`, progression/deload labels.
- `RecordManualScreen` reads `weight_kg` / `rest_sec` / `duration_sec`; intensity heuristic falls back to `rpe`.

## Prompts
- `system_program_create.md`: numeric example with deload + progression, "Progressive overload" section, numeric-key rules. `system_program_modify.md`: progression semantics + "Progression and history". Review prompts: unit hint. All sport skills converted to numeric keys with "Progression Rules" sections.

## Deviations / notes
- No data migration: existing dev programs keep old string prescriptions (no users yet).
- Not done (follow-ups): Grit auto-adjusting progression after reviews (`adjust_progression`), a volume-load chart on Program Detail, progression UI in manual program creation, a preview endpoint for manual creation.

## Key files
- Backend: `models/prescription.go`, `models/progression.go`, `models/template.go`, `models/program.go`, `services/program_series.go`, `services/program.go`, `services/workout.go`, `services/export.go`, `tools/tools.go`, `handlers/program.go`, `handlers/chat.go`, `review/deviation.go`, `review/analytics.go`, `db/migrations/035_progressive_overload.sql`.
- Frontend: `utils/prescription.ts`, `components/PrescriptionEditor.tsx`, `components/PrescriptionDisplay.tsx`, `components/WeeklyLoadBars.tsx`, `components/ProposalReviewView.tsx`, `components/ProgramProposalCard.tsx`, `screens/ProgramDetailScreen.tsx`, `services/api.ts`.
- Tests: `models/progression_test.go`, `models/prescription_test.go`, `services/program_series_test.go` (DB), `services/workout_completion_test.go`, `frontend/src/__tests__/prescription.test.ts`.
