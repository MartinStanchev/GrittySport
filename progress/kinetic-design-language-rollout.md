# Kinetic Design Language Rollout

Extended the newer home/program proposal design language across the rest of the authenticated app by introducing shared Kinetic UI primitives and restyling older screens to use the same typography, card treatment, pill badges, and CTA hierarchy.

## Changes

### Shared UI System
- Added `frontend/src/components/Kinetic.tsx` with reusable Kinetic header, panel, and badge primitives.
- Updated `StepIndicator` to use the newer elongated active-step treatment.
- Tuned the bottom tab bar/header typography to better match the newer editorial look.

### Screen Refreshes
- Restyled `ProgramsScreen` with a stronger hero header, richer empty state, and Kinetic cards for program rows.
- Updated `HistoryScreen` with the same header language, rounded action buttons, and card-based workout rows.
- Refreshed `SettingsScreen` and `BodyMetricsScreen` to use panel sections instead of plain stacked form groups.
- Updated `ImportScreen` to use the same top-level header and card-based import list treatment.
- Brought the manual program creation wizard (`CreateProgramBasicsScreen`, `CreateProgramScheduleScreen`, `CreateProgramReviewScreen`) into the same visual system.
- Refined typography and control shapes in `ProgramDetailScreen`, `WorkoutDetailScreen`, `ActivityDetailScreen`, `LogActivityScreen`, and `RecordManualScreen` to align with the newer home/proposal styling.

### Simplification
- Consolidated the repeated “editorial dark card” styling into the new shared Kinetic components instead of duplicating it per screen.
- Reused existing theme tokens and fonts instead of introducing another parallel design token layer.

## Verification
- Frontend tests: `npm test -- --runInBand` ✅ (159 passing)
- Frontend lint: `npm run lint` ✅ with pre-existing warnings in unrelated files
- Backend lint: `golangci-lint run` ✅
- Backend tests: `go test ./...` ⚠️ pre-existing failure in `backend/internal/ai/prompt_test.go` due missing prompt fixture / nil prompt loader

## Notes
- I performed a manual simplification pass after the refactor. A dedicated “code simplifier agent” was not available in this environment.
