# Task 22: Enhanced Memory Retrieval

## Summary
Make memory assembly topic-aware by tagging segment summaries and filtering by relevance to the current conversation mode.

## Context
Currently `AssembleMemory` always loads all active facts + the last 3 completed segment summaries regardless of context. For example, during program creation, a summary about a random coaching chat from last week isn't useful, but a summary about the user's injury discussion is critical.

## Requirements

### Segment tagging
- Add a `tags TEXT[]` column to the `chat_segments` table (new migration)
- Update `buildSummarizePrompt` in `memory/prompts.go` to request tags from the LLM alongside the summary
  - Tags should be short identifiers like: `running`, `cycling`, `swimming`, `strength`, `injury:knee`, `goal:marathon`, `schedule`, `nutrition`
- Update `SummarizeSegment` in `memory/service.go` to save extracted tags to the new column

### Mode-aware memory assembly
- Update `AssembleMemory` to accept a `mode string` parameter
- Retrieval strategies by mode:
  - **`general_coaching`**: All active facts + last 3 segments (current behavior, unchanged)
  - **`program_creation`**: All active facts + up to 5 segments tagged with the relevant sport or `injury`/`goal` tags
  - **`program_management`**: All active facts + last 3 segments of type `program_modification` or matching sport tags
  - **`workout_review`**: All active facts + last review segment + segments tagged with the workout's sport
- If tag-based query returns fewer than 3 segments, fall back to most recent segments to fill the gap

### Migration
- Add migration file for the `tags` column on `chat_segments`

## Files to modify
- `backend/internal/memory/service.go` - Update `AssembleMemory` signature and query logic
- `backend/internal/memory/prompts.go` - Update `buildSummarizePrompt` to request tags
- New: `db/migrations/018_segment_tags.sql` (or next available number)
- `backend/internal/handlers/chat.go` - Pass mode to `AssembleMemory`

## Dependencies
- Task 19 (mode detection provides the mode value)
- Can be implemented independently of Tasks 20-21
