# Segment-Based Chat Memory

## Summary
Replaced the old single-summary `chat_memory` system with automatic segment-based conversation memory. Conversations are segmented by topic and time, each segment is summarized independently via LLM, and persistent user facts (injuries, goals, preferences) are extracted and stored separately. Grit now remembers long-term context without bloating the LLM prompt.

## Key Changes

### Database
- **Migration `017_segment_based_memory.sql`**: Creates `chat_segments` and `chat_facts` tables, migrates old `chat_memory` data, drops `chat_memory`
- `chat_segments`: tracks conversation segments with type, status, summary, start/end message refs
- `chat_facts`: stores extracted user facts (injuries, goals, preferences, etc.) with active/inactive state

### New Backend Package: `backend/internal/memory/`
- **`service.go`**: Core service with segment lifecycle (start, close, summarize), fact extraction, memory assembly
  - `AssembleMemory()` builds structured memory string for system prompt injection (user facts + last 3 session summaries)
  - `CloseAndSummarize()` / `CloseActiveAndSummarize()` — consolidated close + async summarize pattern
  - `CheckSegmentCompletion()` — LLM-assisted check if segment looks complete
  - `DetectSegmentType()` — LLM classification for ambiguous messages
- **`prompts.go`**: Three LLM prompt templates using cheap model (gemini-2.0-flash-lite)
- **`prompts_test.go`** / **`service_test.go`**: Unit tests

### Chat Handler (`handlers/chat.go`)
- Replaced `memoryEnabled bool` with `memoryService *memory.Service`
- On WS connect: assembles memory, restores active segment, seeds lastMessageTime
- On each message: 2h gap detection → LLM completion check → segment boundary management
- Tool completion signals trigger segment closure: `confirm_program_save`, `confirm_adjustment`, `confirm_program_modification`
- `create_draft_program` transitions from `general_coaching` to `program_creation`
- Removed: `handleClearContext`, `clear_chat` case, `ClearMemory` handler

### Review Service (`review/service.go`)
- Added `memoryService` field; `startReviewSegment` helper closes active segment and starts review segment
- `TriggerReview` → `post_workout_review` segment; `TriggerMissedReview` → `missed_workout_checkin` segment

### Chat Service Cleanup (`services/chat.go`)
- Removed: `SaveMemory`, `GetMemory`, `ClearMessages`, `ClearMemory`

### AI Client (`ai/gemini.go`)
- Replaced `SummarizeConversation` with general `GenerateCheap(ctx, prompt)` for any cheap LLM call

### System Prompt (`prompts/system.md`)
- Changed memory section header to "What you know about this user" with guidance to focus on injuries/health

### Frontend Cleanup
- Removed all clear chat/memory UI: `ClearChatModal.tsx` (deleted), clear button from HomeScreen, memory button from SettingsScreen, `clearChatMemory()` calls from ProgramDetailScreen/ProgramsScreen, `clearChatMemory` from api.ts
- Removed 6-hour auto-clear useEffect and `clearChat` from useChatWebSocket
- Removed `ENABLE_CHAT_MEMORY` env var from docker-compose.yml

### Main.go
- Creates `memoryService` and passes to chat handler and review service
- Removed `chatMemoryEnabled` env var and `/chat/memory` DELETE route

## Segment Types
- `program_creation`, `post_workout_review`, `missed_workout_checkin`, `program_modification`, `general_coaching`

## Fact Types
- `injury`, `health_condition`, `preference`, `goal`, `schedule_constraint`, `equipment`, `sport_focus`

## Segment Lifecycle
1. User sends message → gap detection (2h+) → LLM completion check → close/summarize if complete
2. No active segment → start new one (classify type via LLM)
3. Tool signals (confirm_program_save, etc.) → explicit segment closure + async summarization
4. Review service injects message → close active segment, start review segment

## Race Condition Handling
- `CloseSegment` uses `WHERE status = 'active'` (idempotent)
- `StartSegment` auto-closes existing active segment in single transaction
- Summarization runs async in goroutines
