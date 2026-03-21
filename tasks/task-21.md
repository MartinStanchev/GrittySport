# Task 21: Mode Escalation

## Summary
Add a safety net that automatically retries with a broader tool set when the model tries to call a tool not available in the current mode.

## Context
Rule-based mode detection is correct ~85-90% of the time. For the remaining cases (e.g., user says "modify my Tuesday run" but mode was detected as `general_coaching`), the model will try to call a tool like `propose_program_modification` that isn't in the current tool set. Instead of failing, the system should detect this, switch to the appropriate broader mode, and retry.

## Requirements

### Escalation detection
- In the `executeTool` callback within `handleWithTools`, detect when `registry.Execute` returns an "unknown tool" error AND the tool name exists in the full registry (i.e., it's a valid tool that's just not in the current mode)
- This distinguishes mode mismatch from actual invalid tool names

### Escalation logic
- On detecting a mode mismatch:
  1. Log the escalation event (original mode, target tool name, new mode)
  2. Determine the correct mode from the requested tool name (each tool is tagged with modes from Task 18)
  3. Rebuild the tool set and system prompt for the new mode
  4. Retry the current turn once with the broader context
- Add an `escalated bool` flag to the session/turn state to prevent infinite escalation loops
- If already escalated, fall back to loading all tools (`GeminiTools()`)

### Escalation mapping
- Tool in `program_creation` set -> escalate to `program_creation`
- Tool in `program_management` set -> escalate to `program_management`
- If ambiguous (tool exists in multiple modes), prefer the mode with fewer tools

## Files to modify
- `backend/internal/handlers/chat.go` - Add escalation detection and retry logic
- `backend/internal/ai/gemini.go` - May need to support rebuilding mid-turn (or the handler retries the full `ChatWithTools` call)

## Dependencies
- Task 18 (tool registry filtering)
- Task 19 (mode detection)
- Task 20 (composable prompt, for rebuilding with correct sections)
