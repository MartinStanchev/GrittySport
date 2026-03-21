# Mode Escalation (Task 21)

Adds a safety net that automatically retries with the correct tool set when mode detection is wrong and the model hallucinates a tool call outside the current mode.

## What was built
- **`ErrModeEscalation` error type** in `chat` package — carries tool name, original mode, target mode
- **Registry helper methods** — `Exists`, `ToolInMode`, `ModeForTool` (picks mode with fewest tools when ambiguous)
- **Escalation detection** in `executeTool` closure — checks if tool exists in registry but not in current mode's set
- **Abort in `ChatWithTools`** — when escalation error is returned, aborts the turn immediately (no partial streaming)
- **Retry logic in `handleWithTools`** — switches to target mode, rebuilds tools + system prompt, retries once
- **`escalated` flag** on `sessionState` — prevents infinite loops, reset per turn
- **Signature change** — `handleWithTools` now takes `userName, memory, user` instead of `systemPrompt` so it can rebuild the prompt on retry

## Key files changed
- `backend/internal/chat/escalation.go` (new)
- `backend/internal/chat/escalation_test.go` (new)
- `backend/internal/tools/registry.go` — added 4 methods
- `backend/internal/tools/registry_test.go` — added 3 test functions
- `backend/internal/ai/gemini.go` — escalation check in tool loop + `chat` import
- `backend/internal/handlers/chat.go` — signature change, escalation detection + retry

## Design notes
- Escalation happens at most once per turn. After that, `Execute` uses the full registry as fallback.
- `ModeForTool` disambiguates multi-mode tools by picking the mode with fewer total tools.
- The `!session.escalated` guard in the closure ensures the retry never triggers a second escalation.
