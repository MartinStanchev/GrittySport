# Task 24: Mode Observability + Logging

## Summary
Add structured logging throughout the mode detection and tool filtering system to enable monitoring and debugging of routing decisions.

## Context
When mode detection, tool filtering, and escalation are in place, we need visibility into how the system is performing: which modes are used most, how often escalation fires, and whether the tool reduction is working as expected.

## Requirements

### Logging points
Add structured log entries (using existing `zerolog` logger) at these points:

1. **Mode detection** (every message):
   - Log: detected mode, detection source (state/segment/classify/default), user_id
   - Level: Debug

2. **Tool count** (every message):
   - Log: number of tools loaded for the mode vs total tools
   - Level: Debug

3. **Mode escalation** (when triggered):
   - Log: original mode, requested tool name, escalated-to mode
   - Level: Info (these are worth monitoring)

4. **Memory assembly** (every message):
   - Log: number of facts loaded, number of segments loaded, mode used
   - Level: Debug

5. **Fact decay** (when background job runs):
   - Log: number of facts deactivated by type
   - Level: Info

### Log format
Use structured fields for easy querying:
```go
log.Debug().
    Str("user_id", userID).
    Str("mode", string(mode)).
    Str("source", "segment_continuation").
    Int("tool_count", len(tools)).
    Msg("Chat mode detected")
```

## Files to modify
- `backend/internal/handlers/chat.go` - Mode detection and escalation logging
- `backend/internal/memory/service.go` - Memory assembly and fact decay logging

## Dependencies
- Should be done alongside or after Tasks 18-23 as logging is added to each feature.

## Notes
- This task is lightweight and can be partially done within each preceding task. The task exists to ensure logging isn't forgotten and to consolidate any gaps.
