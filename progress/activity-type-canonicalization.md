# Activity Type Canonicalization

## Goal

Eliminate the format mismatch between Grit's program-creation enum (Title Case strings like `"Easy Run"`) and the rest of the app (snake_case `"run"`, `"strength_training"`). Collapse run sub-flavors (Easy/Long/Tempo/Interval/Trail) into a single canonical `run` type, with the workout's character expressed through `notes` and `prescription` instead of a dedicated activity type.

## Decisions

- **Snake_case everywhere** — backend tools, DB writes, frontend constants, and Grit's prompts.
- **No run sub-flavors as types** — `run` and `indoor_run` are the only running types. Sub-flavor lives in `notes` ("Easy", "Tempo", "Intervals", "Long run", "Trail") and the `prescription` shape.
- **Keep indoor variants** — `indoor_run` and `indoor_cycling` remain distinct because they use different recording flows (no GPS, treadmill speed input, etc.).
- **No DB migration** — pre-launch app; user will drop and rebuild the DB. Per AGENTS.md no backwards compatibility.

## Canonical enum (16 values)

```
run, walk, cycling, swim, open_water_swim,
indoor_run, indoor_cycling,
strength_training, mobility, yoga, recovery, rest, drill,
cross_training, outdoor_activity, indoor_activity
```

## Key files changed

### Backend
- `backend/internal/tools/tools.go` — replaced 21-value Title Case `ActivityTypes` with 16 snake_case values.
- `backend/prompts/system_program_create.md` — updated example JSON and added explicit "run sub-flavors do not exist as types" guidance with notes-label suggestions.
- `backend/prompts/skills/running.md` — added Run Types section documenting the single-type-with-notes pattern.
- `backend/internal/review/deviation.go` — rewrote `activityTypeFamily` and `activityTypesInFamily` for snake_case (run, cycling, swim, strength, mobility families).
- `backend/internal/review/deviation_test.go` — updated expected family mappings.
- `backend/internal/models/program_test.go` — fixture activity types changed to snake_case.
- `backend/internal/tools/registry_test.go` — `"activity_type":"Run"` → `"activity_type":"run"`.

### Frontend
- `frontend/src/constants/activityIcons.ts` — added centralized `ACTIVITY_TYPES` constant + `ActivityType` type. Pruned sub-flavor entries from `ACTIVITY_ICONS`, `ACTIVITY_DISPLAY_NAMES`, and updated `IMPORT_ACTIVITY_TYPES` and `MANUAL_ROOTS`.
- `frontend/src/screens/ActivityDetailScreen.tsx` — imports `ACTIVITY_TYPES`; default state `'Easy Run'` → `'run'`.
- `frontend/src/screens/CreateProgramScheduleScreen.tsx` — imports `ACTIVITY_TYPES` and `WEEK_DAYS_MON_SUN` from constants.
- `frontend/src/screens/RecordManualScreen.tsx` — `strength` → `strength_training` in `INDOOR_OPTIONS` / `DISPLAY_TYPE_LABELS`. Fixed bug where the saved `activity_type` was the display label (e.g. "Mobility / Recovery") instead of the canonical type — added `activityType` field to `ActiveWorkout` context and use it in `saveWorkout`.
- `frontend/src/contexts/WorkoutContext.tsx` — added `activityType: string` to `ActiveWorkout` interface.
- `frontend/src/screens/LogActivityScreen.tsx` — removed `'trail_run'` from `PACE_TYPES`; `strength` → `strength_training` checks.
- `frontend/src/services/healthKitService.ts` — remapped HealthKit types: `traditionalStrengthTraining`/`functionalStrengthTraining`/`coreTraining` → `strength_training`; `hiking` → `run`; `highIntensityIntervalTraining` → `run`; `crossTraining`/`rowing`/`mixedCardio` → `cross_training`.
- `frontend/src/__tests__/healthKitMapping.test.ts` — updated 5 expected mappings.
- `frontend/src/screens/HistoryScreen.tsx` — filter chip key `strength` → `strength_training`.

## Bugs fixed along the way

1. **RecordManualScreen saved display labels as `activity_type`** — `activeWorkout.activityDisplayType` (e.g. "Pool Swim", "Mobility / Recovery") was being persisted to `workouts.activity_type` instead of the canonical type. Now stores `activeWorkout.activityType` separately on the active-workout context.

## Validation

- `go build ./...` — passes
- `go test ./...` — all packages pass
- `golangci-lint run` — clean
- `npx jest` — 182/182 passing
- `npx tsc --noEmit` — refactored files clean (pre-existing errors in LiveHRChart, WorkoutCharts, useNotifications are unrelated)
- `npx eslint src` — only pre-existing warnings/errors (unrelated)
