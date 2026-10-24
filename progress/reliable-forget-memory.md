# Reliable forget memory

## Summary
A user told Grit to forget an ankle injury (mentioned during program creation) and it kept
coming back. `forget_memory` was registered in all four modes, but it only deactivated a
`chat_facts` row by exact text, so the injury survived through several other paths. This
change makes forgetting reliable end-to-end.

## Root causes
1. **Exact-text match** — `RemoveMemory` needed `LOWER(content) = LOWER($2)`; any paraphrase by the LLM returned `not_found`.
2. **Session summaries untouched** — the injury lived on in `chat_segments.summary` ("Recent Sessions"). A program-creation summary tagged `injury`/`program` is picked by every specialized mode's tag filter.
3. **Re-extraction** — summarizing the "please forget my injury" conversation could extract the injury again as a new active fact (the dedupe only checked active rows).
4. **Stale per-connection memory** — in general coaching mode memory was assembled once per WebSocket connection, so a forget wasn't reflected until reconnect.
5. **Raw history** — the last 50 messages still mention it (handled via instruction, see below).

## Changes
- **Migration `034_forgotten_facts.sql`**: `chat_facts.forgotten_at` (marker; NULL for decayed/superseded) + `summaries_redacted_at` (NULL = summary scrub still owed) + partial index.
- **Forget by ID** (`memory/service.go`, `tools/tools.go`): chat memory lines carry `[id:xxxxxxxx]` (8-hex prefix of the fact UUID). `forget_memory` now takes `memory_ids: string[]`; `normalizeMemoryIDs` tolerates `id:` prefix/case/whitespace. `RemoveMemory` → `ForgetMemories` / `markForgotten` (`UPDATE … RETURNING`, scoped by `user_id`). Tool result carries the "treat as no longer true, don't raise it again even if earlier messages mention it" instruction so it lands in context even when memory becomes empty.
- **Summary redaction**: `redactPending` → `redactSummaries` sends the forgotten facts plus up to 30 completed summaries (fact source segments first, then most recent) to the cheap model (Standard tier — Flex latency would leave the old summary visible on the next turn), applies rewrites in one `unnest` UPDATE; a summary that ends up empty becomes NULL and drops out of assembly. Runs async right after the forget; the renamed `MaintenanceScheduler` (was `FactDecayScheduler`) retries pending redactions daily via `RedactPendingForgotten`.
- **No re-extraction**: `SummarizeSegment` loads facts forgotten after the segment's `started_at` (`getForgottenSince`), lists them in the summarize prompt ("do NOT extract or mention… unless reported again as new"), and skips exact matches (`isForgotten`). Conversations that start after the forget are unaffected, so a genuine re-injury is still captured.
- **Fresh memory every turn** (`handlers/chat.go`): `buildSystemPrompt` assembles memory itself; removed the `assembledMemory` plumbing through `handleWithTools` / `handleProposalResponse` / `handleSegmentBoundary` (which now reuses `closeSessionSegment`).
- **ID tags only where needed**: `AssembleMemory(…, IDTags)` — chat passes `WithIDTags`, post-workout/missed reviews pass `WithoutIDTags` (no tools there; keeps IDs out of push previews).
- **Prompt**: `system_base.md` explains the `[id:…]` tags (never shown to the user) and to pass every matching ID.
- **Export**: `chat_facts` export includes `forgotten_at`.
- Small cleanups: `factColumns` const for `queryFacts` callers, shared `factLine` formatter.

## Deviations / notes
- `GetActiveFacts` still caps at 20 facts; facts beyond the cap have no visible ID until newer ones are removed (pre-existing).
- Two concurrent redactions for the same user can race (last writer wins); both process all pending facts, so this is rare and self-limiting.
- Existing injured summaries from before this change are not retroactively scrubbed — the user needs to say "forget" once more (or the fact must be forgotten) to trigger redaction.

## Validation
- `go build ./...`, `go vet ./internal/...`, `go test ./internal/...` pass.
- New unit tests: `normalizeMemoryIDs`, `isForgotten`, `parseRedactionUpdates`, forgotten section in summarize prompt, redaction prompt.
- New DB test `memory/service_db_test.go` (`TestMarkForgotten_ByShortID`) — skipped locally (no `TEST_DATABASE_URL`).
- `golangci-lint run --new-from-rev=HEAD ./...` clean.
- `/simplify` (reuse/simplification/efficiency/altitude) applied; skipped: Flex tier for redaction (latency), batching memory queries per turn (ms vs multi-second LLM), read-path-derived redaction candidates (emptied summaries pull older ones into view, so the 30-recent set is the safer superset).

## Key files
- `db/migrations/034_forgotten_facts.sql`
- `backend/internal/memory/service.go`, `prompts.go`, `scheduler.go`
- `backend/internal/tools/tools.go`
- `backend/internal/handlers/chat.go`
- `backend/internal/review/service.go`
- `backend/prompts/system_base.md`
- `backend/main.go`, `backend/internal/services/export.go`
