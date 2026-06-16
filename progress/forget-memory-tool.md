# Forget memory tool (preferences + auto-extracted facts)

## Summary
Generalized Grit's "forget" tool so it can remove **both** explicit user preferences
and auto-extracted facts. Previously `forget_user_preference` only deactivated rows
with `fact_type = 'explicit_preference'`, leaving auto-extracted facts (injury,
schedule, goal, etc.) un-forgettable on demand — they could only age out via memory
decay. Renamed the tool to `forget_memory` so the LLM understands its broader scope.

## Background
Both kinds of memory live in the same `chat_facts` table:
- `fact_type = 'explicit_preference'` → assembled under `### User Preferences` (`- content`)
- other fact types (auto-extracted) → assembled under `### User Facts` (`- [type] content`)

`save_user_preference` is unchanged (facts have no save tool — they're auto-extracted).

## Changes
- **`backend/internal/memory/service.go`**: Renamed `RemoveExplicitPreference` →
  `RemoveMemory`; dropped the `fact_type = 'explicit_preference'` filter so the
  `UPDATE ... SET active = false` deactivates any active fact matching `content`
  (case-insensitive), regardless of type.
- **`backend/internal/tools/tools.go`**: Renamed tool `forget_user_preference` →
  `forget_memory`; broadened the description to cover both User Preferences and User
  Facts; instructs the model to pass only the fact text (omit the leading `[type]`
  label shown in User Facts); handler now calls `RemoveMemory`; `not_found`/`removed`
  messages reworded ("No matching memory found…", "Forgotten.").
- **`backend/internal/tools/registry_test.go`**: Updated the 5 expected tool-name
  occurrences to `forget_memory`. Tool is still registered in all four conversation
  modes; counts unchanged (pure rename).

## Validation
- `go build ./...` clean
- `go test ./internal/tools/... ./internal/memory/...` pass
- `golangci-lint run` on both packages clean
- code-simplifier reviewed: no changes needed
