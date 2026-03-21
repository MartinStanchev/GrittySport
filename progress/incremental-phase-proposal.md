# Incremental Phase-Based Program Proposal

Fixes `MALFORMED_FUNCTION_CALL` errors when Gemini tries to output an entire multi-phase program in a single `propose_program` tool call. Breaks the proposal into incremental `save_draft_phase` calls (one per phase), then a lightweight `propose_program` that assembles from saved phases.

## Problem

For complex programs (e.g. triathlon with 4-5 phases, 6 activities each with detailed prescriptions), the `propose_program` function call JSON was too large for Gemini's function calling mechanism. This caused `MALFORMED_FUNCTION_CALL` with 0 output tokens, and the fallback leaked tool-code syntax (`|||TOOL_CODE|||`) to the user.

## What was built

### Incremental phase accumulation
- Added `DraftPhases []models.TemplatePhaseInput` field to `PendingProposal`
- `AddPhase(userID, phase)` — appends a phase, refreshes TTL, returns count
- `UpdatePhase(userID, orderIndex, phase)` — replaces a phase by order_index (decomposes from assembled Program if needed)
- `DeletePhase(userID, orderIndex)` — removes a phase by order_index (decomposes from assembled Program if needed)
- `PhaseCount(userID)` — for session context injection
- `decomposeProgram()` — extracts phases from assembled Program JSON back into DraftPhases (enables update/delete after proposal rejection)

### Phase tools (all `program_creation` mode)
- **`save_draft_phase`** — saves a single phase to the accumulator. Returns phase_count.
- **`update_draft_phase`** — replaces a previously saved phase by its `order_index`. Same schema as save. Works both pre-propose and post-rejection (decomposes assembled program).
- **`delete_draft_phase`** — removes a phase by `order_index`. Works both pre-propose and post-rejection.
- Phase schema and parsing extracted into shared `phaseSchema()` and `parsePhaseParams()` helpers to avoid duplication.

### Simplified `propose_program` tool
- No longer accepts `phases` in the `program` parameter — only metadata (name, sport, goal_description, start/end dates)
- Assembles full program from metadata + accumulated `DraftPhases`
- Returns error if no phases were saved via `save_draft_phase`
- `criteria` parameter unchanged
- Downstream tools (`modify_pending_proposal`, `start_program_today`, `confirm_program_save`) unchanged

### System prompt updates
- Program generation section describes the two-step flow: save phases, then propose
- Documents `update_draft_phase` and `delete_draft_phase` for pre-propose fixes and post-rejection rebuilds
- Active session context includes phase count so Grit doesn't re-save phases across turns

### Malformed function call safety net
- On `MALFORMED_FUNCTION_CALL`, first retry WITH tools + simplification hint
- If still malformed, fall back to no-tools with explicit prohibition of tool-code syntax
- `stripToolCode()` sanitizer removes leaked `|||TOOL_CODE|||`, ` ```tool_code`, ` ```python\nprint(` patterns

## New flow
1. `create_draft_program` → creates draft (unchanged)
2. `save_draft_criterion` × N → saves criteria (unchanged)
3. `save_draft_phase` × 3-5 → saves one phase per call (~1-3KB each)
4. `propose_program` → lightweight metadata-only call, assembles from saved phases
5. User reviews → `confirm_program_save` (unchanged)
6. If rejected: `update_draft_phase` / `delete_draft_phase` to modify, then `propose_program` again

## Key files changed
- `backend/internal/tools/proposals.go` — DraftPhases, AddPhase, UpdatePhase, DeletePhase, PhaseCount, decomposeProgram
- `backend/internal/tools/tools.go` — save/update/delete_draft_phase tools, phaseSchema/parsePhaseParams helpers, simplified propose_program
- `backend/internal/handlers/chat.go` — phase count in system prompt via ProposalStore.PhaseCount
- `backend/prompts/system_program_create.md` — two-step generation + update/delete instructions
- `backend/internal/tools/registry_test.go` — new tools in stubs, ProposalStore + decompose tests, updated counts
- `backend/internal/ai/gemini.go` — malformed retry with tools, stripToolCode, improved fallback hints
- `backend/internal/ai/prompt_test.go` — stripToolCode tests

## Expected impact
- Each `save_draft_phase` call is ~1-3KB of JSON (one phase with ~6 activities) — well within Gemini limits
- `propose_program` is now ~200 bytes (metadata only) instead of ~10-15KB (full program)
- Detailed prescriptions (exercises, sets, reps, paces, drill descriptions) are fully preserved
- Post-rejection phase edits work seamlessly via decomposition
- Zero changes to frontend, DB schema, or downstream save/modify flows
