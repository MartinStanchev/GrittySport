# Fix program modification validation + add_week_activity tool

## Problem
- `propose_program_modification` did zero validation on `program_id`, so AI hallucinated IDs would silently store and fail at `confirm_program_modification` time with "program not found"
- No way to add/modify an activity for a single specific week (only all weeks or by phase)

## Changes

### Bug fix: Validate program_id at propose time
- Extracted `VerifyProgramOwnership(ctx, programID, userID)` from `ModifyProgram` into a reusable method in `program.go`
- `ModifyProgram` now calls `VerifyProgramOwnership` instead of inline ownership check
- `propose_program_modification` handler in `tools.go` now validates the program exists and belongs to the user before storing the proposal — gives AI immediate error feedback

### New tool: `add_week_activity`
- Direct-apply tool (no propose/confirm flow) for adding a single activity to a specific week
- Parameters: `program_id`, `week_id`, `day_of_week`, `activity_type`, `prescription`, `notes`
- Validates program ownership and that the week belongs to the program
- `AddActivityToWeek` method added to `ProgramService`
- `AddWeekActivityInput` model added

### System prompt updated
- Added "Choosing the right tool" section under Program Modification
- Documents when to use `add_week_activity` vs `propose_program_modification`

### WS dispatch
- `add_week_activity` sends `program_updated` WS event so frontend refreshes

## Key files changed
- `backend/internal/services/program.go` — `VerifyProgramOwnership`, `AddActivityToWeek`
- `backend/internal/models/program.go` — `AddWeekActivityInput`
- `backend/internal/tools/tools.go` — validation in propose handler, new tool registration
- `backend/internal/handlers/chat.go` — WS dispatch case
- `backend/prompts/system.md` — tool documentation
