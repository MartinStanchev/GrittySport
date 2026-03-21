# Conversation Modes (Tasks 18, 19, 20)

Introduces conversation modes that filter tools and system prompt sections per chat turn, reducing token waste by ~65% for general coaching messages.

## Task 18: Tool Registry — Mode-Based Filtering
- Added `Mode` type with 4 constants in new `backend/internal/chat/mode.go`
- Added `Modes []chat.Mode` field to `Tool` struct
- Added `GeminiToolsForMode(mode)` to `Registry` — filters tools by mode, falls back to all if none match
- Tagged all 19 tools with their valid modes (4 for coaching, 11 for creation, 10 for management, 3 for review)
- Tests: `registry_test.go` with table-driven tests for each mode

## Task 19: Mode Detection + Handler Integration
- Added `DetectMode(ModeContext) Mode` — pure Go, zero-latency priority chain:
  1. Active draft ID → program_creation
  2. Pending proposal type → creation or management
  3. Active segment type → matching mode
  4. Persisted mode from previous turn
  5. Default: general_coaching
- Updated `DetectSegmentType` and `buildClassifyPrompt` to recognize `program_creation` intent
- Added `activeSegmentType` and `mode` to `sessionState`
- Mode detection runs before every `handleWithTools` call (both normal and proposal response)
- Mode transitions: `create_draft_program` → creation, `confirm_*` → coaching
- Tests: `mode_test.go` with 15 table-driven tests

## Task 20: Composable System Prompt
- Split `system.md` (261 lines) into 4 composable files:
  - `system_base.md` (always loaded): personality, user context, skills, formatting
  - `system_program_create.md` (program_creation): draft flow, criteria, generation, modification
  - `system_program_modify.md` (program_management): saved program modification flow
  - `system_review_context.md` (workout_review): post-workout/missed workout follow-up guidance
- Restructured `PromptLoader` to store `map[string]*template.Template`
- `BuildSystemPromptForMode` assembles base + mode section; `{{.Criteria}}` only injected in creation mode
- Tests: `prompt_test.go` verifying each mode loads correct sections

## Key Files Changed
- `backend/internal/chat/mode.go` (new)
- `backend/internal/chat/mode_test.go` (new)
- `backend/internal/tools/registry.go`
- `backend/internal/tools/registry_test.go` (new)
- `backend/internal/tools/tools.go`
- `backend/internal/handlers/chat.go`
- `backend/internal/ai/gemini.go`
- `backend/internal/ai/prompt_test.go` (new)
- `backend/internal/memory/prompts.go`
- `backend/internal/memory/service.go`
- `backend/prompts/system_base.md` (new, from system.md lines 1-48)
- `backend/prompts/system_program_create.md` (new, from system.md lines 50-177)
- `backend/prompts/system_program_modify.md` (new, from system.md lines 180-261)
- `backend/prompts/system_review_context.md` (new)
- `backend/prompts/system.md` (deleted)

## Expected Impact
- General coaching: 4 tools instead of 19, ~1000 system prompt tokens instead of ~3000
- Program creation: 11 tools, full creation instructions loaded
- Program management: 10 tools, modification instructions loaded
- Workout review: 3 tools, review context loaded
- Zero additional latency (pure Go mode detection)
