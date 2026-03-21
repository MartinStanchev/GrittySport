# Mode Observability + Logging (Task 24)

Adds structured zerolog entries throughout the mode detection, tool filtering, memory assembly, and fact decay systems for monitoring and debugging.

## What was built

### Mode detection logging (Debug, every message)
- `DetectMode` now returns `ModeResult{Mode, Source}` instead of just `Mode`
- Source values: `"state"`, `"proposal"`, `"segment"`, `"previous"`, `"default"`
- Logged at both user message and proposal response paths in the chat handler

### Tool count logging (Debug, every turn)
- Logs `tool_count` (tools loaded for the mode) vs `total_tools` (all registered tools)
- Added `TotalToolCount()` to `Registry`

### Mode escalation logging (Info, when triggered)
- Already existed from Task 21 — no changes needed

### Memory assembly logging (Debug, every message)
- Logs `facts` count, `segments` count, and `mode` used for filtering

### Fact decay logging (Info, when facts deactivated)
- Enhanced `RunFactDecay` to log per-type breakdown: `injury_health`, `schedule_constraint`, `total`

## Key files changed
- `backend/internal/chat/mode.go` — `ModeResult` struct, `DetectMode` returns `ModeResult`
- `backend/internal/chat/mode_test.go` — tests updated for `ModeResult` with source assertions
- `backend/internal/handlers/chat.go` — mode source + tool count logging at both message paths
- `backend/internal/tools/registry.go` — `TotalToolCount()` method
- `backend/internal/memory/service.go` — memory assembly logging, per-type fact decay logging
