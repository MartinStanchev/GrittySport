# Explicit User Preferences (Task 25.1)

Adds a Grit tool for users to explicitly save preferences ("remember to always...") that persist across conversations and are always included in context.

## What was built

### New fact type: `explicit_preference`
- Migration 020 adds `explicit_preference` to the `chat_facts` `fact_type` CHECK constraint
- Stored in the same table as auto-extracted facts but retrieved and displayed separately

### Memory service methods
- `SaveExplicitPreference(ctx, userID, content)` — saves a preference; if content exceeds 150 characters, condenses it via a cheap LLM call first
- `RemoveExplicitPreference(ctx, userID, content)` — deactivates matching preference (case-insensitive exact match)
- `CountExplicitPreferences(ctx, userID)` — for enforcing tier limits
- `GetExplicitPreferences(ctx, userID)` — returns up to 10 active preferences, newest first

### Memory assembly changes
- `AssembleMemory` now prepends a `### User Preferences` section before `### User Facts`
- Explicit preferences are always included regardless of mode, separate from the 20-fact cap
- `GetActiveFacts` excludes `explicit_preference` to avoid double-counting

### Tools
- `save_user_preference` — available in all 4 modes; checks free tier limit (5 preferences); long content is auto-condensed
- `forget_user_preference` — available in all 4 modes; deactivates by exact content match (case-insensitive)

### Usage limits
- Free users: 5 explicit preferences max (`FreeExplicitPreferencesTotal`)
- Premium users: unlimited (up to the 10-preference assembly cap)
- The chat message that triggers save/forget counts toward the 40 free weekly messages (existing `chat_message` resource)

### No auto-decay
- `RunFactDecay` does not touch `explicit_preference` facts — they persist until the user explicitly asks to forget them

## Key files changed
- `db/migrations/020_explicit_preferences.sql` (new)
- `backend/internal/memory/service.go` — 4 new methods, updated `GetActiveFacts` exclusion, updated `AssembleMemory`
- `backend/internal/memory/prompts.go` — `buildCondensePreferencePrompt`, `condensePreferenceThreshold`
- `backend/internal/tools/tools.go` — 2 new tools, added `memorySvc` parameter to `RegisterAllTools`
- `backend/internal/handlers/chat.go` — pass `memorySvc` to `RegisterAllTools`
- `backend/internal/usage/service.go` — `FreeExplicitPreferencesTotal` constant
- `backend/internal/tools/registry_test.go` — updated tool counts and name lists
- `backend/internal/memory/prompts_test.go` — tests for condense prompt
- `backend/internal/memory/service_test.go` — test for new formatFactType case

## Related
- Task 26 (`tasks/task-26.md`) spec created for time-bound reminders (separate feature)
