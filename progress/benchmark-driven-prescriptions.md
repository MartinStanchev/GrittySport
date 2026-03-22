# Benchmark-Driven Workout Prescriptions

## Summary
Added performance benchmark collection during program creation and enriched workout prescriptions with `effort` context and standardized `rpe` across all sports.

## What Changed

### Backend Prompts
- **questions.json**: Added "Performance Benchmarks" criteria category — instructs Grit to ask intermediate/advanced users for 1RM, race times, FTP, or CSS depending on sport. Beginners are skipped entirely.
- **system_program_create.md**: Added 2 paragraphs about `effort` and `rpe` fields. Updated all 8 prescription format examples to include both fields.
- **skills/strength_training.md**: Updated prescription examples with `effort` (e.g., "85% 1RM") and concrete weight values.
- **skills/running.md**: Updated prescription examples with `effort` (e.g., "5K goal pace") and `rpe`. Added tempo and long run examples.
- **skills/cycling.md**: Updated prescription examples with `effort` (e.g., "Sweet spot") and `rpe`. Added threshold example.
- **skills/swimming.md**: Updated prescription examples with `effort` (e.g., "CSS pace") and `rpe`. Added speed example.

### Frontend
- **PrescriptionDisplay.tsx**:
  - Added `EffortBadge` component (subtle pill in primary color) for top-level effort display
  - Added `rpe` pill to `SetCard` (renders automatically across all structured workouts)
  - Added `effort` inline text to `SetCard` (below pills, italic primary color)
  - Added `effort` pill per exercise in `StrengthDisplay`
  - Added `RPE` + `EffortBadge` to flat renderers: RunDisplay, SwimDisplay, CyclingDisplay, MobilityDisplay
  - Consolidated duplicate styles into shared `inlineEffort`

## Key Design Decisions
- **Effort as string, not percentage field**: `effort` is a human-readable coaching context string. Actual numeric values (weight, pace, distance) remain in their own fields for deviation analysis.
- **RPE standardized across all sports**: Previously only strength had `rpe`. Now all sports include it, enabling future prescribed-vs-actual RPE comparison in post-workout reviews.
- **Zero backend Go changes**: Prescription JSONB and `save_draft_criterion` already accept arbitrary fields. No migrations needed.
- **Backwards compatible**: Existing prescriptions without `effort`/`rpe` still render correctly — the new UI elements simply don't appear.

## Key Files
- `backend/prompts/questions.json`
- `backend/prompts/system_program_create.md`
- `backend/prompts/skills/strength_training.md`
- `backend/prompts/skills/running.md`
- `backend/prompts/skills/cycling.md`
- `backend/prompts/skills/swimming.md`
- `frontend/src/components/PrescriptionDisplay.tsx`
