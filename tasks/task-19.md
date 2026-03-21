# Task 19: Mode Detection + Handler Integration

## Summary
Implement Go-side rule-based mode detection that determines which conversation mode to use before calling Gemini, and integrate it into the chat handler to pass filtered tools.

## Context
Instead of a separate LLM-based intent classification agent (which adds 800ms+ latency), mode detection uses session state and the existing cheap `DetectSegmentType` LLM call to determine the correct mode with zero additional latency for ~85-90% of messages.

## Requirements

### Mode detection function
Create `DetectMode()` with this priority order:

1. **Active state signals (highest priority, zero latency):**
   - `session.activeDraftID != ""` -> `program_creation`
   - Pending proposal of type `program_creation` -> `program_creation`
   - Pending proposal of type `program_modification` or `program_adjustment` -> `program_management`

2. **Active segment continuation:**
   - Current segment type `program_creation` -> `program_creation`
   - Current segment type `program_modification` -> `program_management`
   - Current segment type `post_workout_review` or `missed_workout_checkin` -> `workout_review`

3. **New conversation classification (uses existing cheap LLM call):**
   - Expand `DetectSegmentType` in `memory/service.go:272` to also recognize `program_creation` (currently only recognizes `program_modification`)
   - Update `buildClassifyPrompt` in `memory/prompts.go:70` to include `program_creation` as a classification type

4. **Default:** `general_coaching`

### Mode transitions during conversation
- When `create_draft_program` tool executes: session mode shifts to `program_creation`
- When `confirm_program_save` executes: mode resets to `general_coaching`, segment closes
- When `confirm_program_modification` / `confirm_adjustment` executes: mode resets to `general_coaching`

### Chat handler integration
- In the chat handler (`handlers/chat.go`), call `DetectMode` before `handleWithTools`
- Pass the detected mode to `handleWithTools` which uses `GeminiToolsForMode(mode)` instead of `GeminiTools()`
- Store the current mode in `sessionState` for persistence across messages

## Files to modify
- New: `backend/internal/chat/mode.go` (or within handlers package) - Mode type, constants, DetectMode function
- `backend/internal/handlers/chat.go` - Integrate mode detection, pass filtered tools
- `backend/internal/memory/service.go` - Expand `DetectSegmentType` return values
- `backend/internal/memory/prompts.go` - Update `buildClassifyPrompt` to include `program_creation`

## Dependencies
- Task 18 (tool registry mode filtering)
