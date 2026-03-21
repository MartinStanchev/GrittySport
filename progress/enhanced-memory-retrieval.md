# Enhanced Memory Retrieval (Task 22)

Makes memory assembly topic-aware by tagging segment summaries during summarization and filtering them by relevance to the current conversation mode.

## What was built

### Segment tagging
- Added `tags TEXT[]` column to `chat_segments` (migration 018) with GIN index for array overlap queries
- Updated `buildSummarizePrompt` to request 1-5 topic tags from the LLM alongside summary and facts
  - Tag vocabulary: `running`, `cycling`, `swimming`, `strength`, `mobility`, `injury`, `goal`, `schedule`, `nutrition`, `program`, `review`
- `SummarizeSegment` now saves extracted tags to the new column in the same UPDATE as the summary
- Added `Tags []string` field to `ChatSegment` model

### Mode-aware memory assembly
- `AssembleMemory` now accepts a `mode string` parameter
- Retrieval strategies by mode:
  - **general_coaching** (default): last 3 segments, unfiltered (unchanged behavior)
  - **program_creation**: up to 5 segments tagged with sport/injury/goal/program tags (`&&` overlap)
  - **program_management**: up to 5 segments of type `program_modification` OR tagged with sport/program tags
  - **workout_review**: up to 3 segments tagged with sport/review tags
- Fallback: if a specialized mode returns fewer than 3 segments, pads with most recent segments

### Per-turn memory reassembly
- When mode is specialized (not general_coaching), memory is reassembled with mode-aware filtering before each turn
- Applies to both normal message handling and proposal response handling
- Initial WS connect still uses default (empty mode) since mode isn't known yet

## Key files changed
- `db/migrations/018_segment_tags.sql` (new)
- `backend/internal/models/memory.go` — added Tags field
- `backend/internal/memory/prompts.go` — updated summarize prompt for tags
- `backend/internal/memory/service.go` — tags in SummarizeSegment, mode-aware AssembleMemory, getSegmentSummaries helper
- `backend/internal/handlers/chat.go` — pass mode to AssembleMemory, per-turn reassembly
- `backend/internal/memory/prompts_test.go` — updated test

## Expected impact
- Program creation/management turns get more relevant segment context (injury history, sport discussions)
- General coaching turns are unchanged (no regression)
- Zero additional LLM calls — tags are extracted in the existing summarization call
