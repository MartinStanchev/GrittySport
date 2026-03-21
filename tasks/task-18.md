# Task 18: Tool Registry - Mode-Based Filtering

## Summary
Extend the tool registry to support named conversation modes so tools can be filtered per request instead of always sending all 21 tools to Gemini.

## Context
Currently `GeminiTools()` in `registry.go:48` returns all 21 tool declarations every time. This wastes tokens and can confuse the model when most tools are irrelevant to the current conversation context (e.g., sending program creation tools during general coaching chat).

## Requirements

### Mode definitions
Define four conversation modes:
- `general_coaching` - questions, advice, small talk (~60-70% of messages)
- `program_creation` - building a new program from scratch
- `program_management` - editing saved programs, adjustments, criteria edits
- `workout_review` - responding to post-workout or missed workout reviews

### Tool struct changes
- Add `Modes []string` field to the `Tool` struct in `registry.go`
- Each tool is tagged with the modes it belongs to during `RegisterAllTools`

### Registry methods
- Add `GeminiToolsForMode(mode string) []*genai.Tool` that returns only tools tagged for that mode
- Keep existing `GeminiTools()` as a fallback that returns all tools (used for mode escalation)

### Tool-to-mode mapping

**general_coaching (4 tools):**
- `read_skill`, `get_user_profile`, `get_active_program`, `set_weekly_effort_goal`

**program_creation (11 tools):**
- `read_skill`, `get_user_profile`, `get_active_program`, `set_weekly_effort_goal`
- `get_draft_program`, `create_draft_program`, `save_draft_criterion`
- `propose_program`, `modify_pending_proposal`, `start_program_today`, `confirm_program_save`

**program_management (10 tools):**
- `read_skill`, `get_active_program`, `get_program_criteria`, `get_scheduled_activity`
- `update_program_criteria`
- `propose_program_modification`, `confirm_program_modification`, `add_week_activity`
- `propose_adjustment`, `confirm_adjustment`

**workout_review (3 tools):**
- `get_active_program`, `get_scheduled_activity`, `read_skill`

## Files to modify
- `backend/internal/tools/registry.go` - Add `Modes` field, add `GeminiToolsForMode` method
- `backend/internal/tools/tools.go` - Tag each tool with its modes in `RegisterAllTools`

## Dependencies
- None. This is the foundation for tasks 19-24.
