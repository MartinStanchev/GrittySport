# Segment-Grouped Chat Headers

Surface a context cue (eyebrow header + thin divider) above Grit-initiated chat
threads — post-workout reviews, missed-workout check-ins, and manual program
edits — so the user understands what each thread is anchored to. Persisted in
the DB so the cue survives reload and pagination.

## What changed

### Backend

- **`db/migrations/022_segment_headers.sql`** — adds `header JSONB` to
  `chat_segments`; extends the `segment_type` CHECK to include `manual_edit`.
- **`models/memory.go`** — adds `SegmentHeader` struct + `Header` field on
  `ChatSegment`; new `ChatSegmentResponse` (omits internal `summary`/`tags`).
- **`memory/service.go`**:
  - `StartSegment` now takes a `header json.RawMessage` and writes it.
  - New `RecordEvent(userID, segmentType, anchorMessageID, header)` — inserts
    a one-shot `completed` segment (used for `manual_edit`) without disturbing
    the user's currently active conversation segment.
  - New `GetSegmentsSince(userID, since)` — used by the chat history endpoint
    to attach segments overlapping the visible message window.
  - All `ChatSegment` scans updated to include `header`.
- **`review/service.go`** — `TriggerReview` and `TriggerMissedReview` now build
  a denormalized `SegmentHeader` and pass it through `startReviewSegment` →
  `StartSegment`. Helpers: `buildPostWorkoutHeader`, `buildMissedWorkoutHeader`,
  `formatLocalTime`, `formatDuration`, `titleCaseActivity`. User timezone is
  fetched from `users.timezone` so the subtitle reads naturally.
- **`handlers/program.go`** — `UpdateActivity` and `UpdateCriteria` now call
  `recordManualEditEvent` after saving the system message, so the manual edit
  surfaces as a header-only entry in chat. `ProgramHandler` gets a new
  `memoryService` dependency.
- **`handlers/chat.go`** — `History` endpoint now returns `{messages,
  segments, has_more}`; segments are fetched via `GetSegmentsSince` bounded by
  the oldest returned message. Pre-existing `StartSegment` callers updated to
  pass `nil` for header.
- **`main.go`** — pass `memoryService` to `NewProgramHandler`.

### Frontend

- **`services/api.ts`** — `ChatSegmentHeader` and `ChatSegmentResponse` types;
  `ChatHistoryResponse` now includes `segments`.
- **`hooks/useChatWebSocket.ts`** — `ChatMessage.messageType` extended with
  `'segment_header'`; new `SegmentHeaderData` payload field.
- **`screens/HomeScreen.tsx`**:
  - `mapHistoryMessages(messages, segments)` — interleaves synthetic
    `segment_header` items into the message stream at segment boundaries
    (filters out `general_coaching` so the absence of a header is itself the
    visual signal for "ordinary chat").
  - `renderMessage` — new branch renders the eyebrow header (label +
    optional subtitle) flanked by hairline rules.
  - Both `getChatHistory` callers (initial load + pagination) pass segments
    through.

## Key decisions

- **Snapshot, not live ref.** Header content (label, subtitle, ref_id) is
  written into the segment row at start time. Renaming a workout later does
  not retroactively change a historical header — the review is an anchor in
  time, not a live record.
- **`general_coaching` gets no header.** Headers signal "Grit started this
  thread"; their absence is the visual cue for ordinary chat. Continuation
  messages (the user replying to a review) flow visually under the review's
  header until the next anchor.
- **Manual edits use `RecordEvent`, not `StartSegment`.** Manual edits should
  not interrupt the user's active conversation; the new method inserts a
  pre-completed segment alongside the active one.
- **No WS `segment` event yet.** Existing post-workout review polling reloads
  history, which now includes segments. The mid-chat freshness gap is
  acceptable for v1.
- **Header API is normalized (separate `segments` array), not embedded.**
  Pagination logic stays simple; the frontend zips them by `started_at`.

## Files changed

- `db/migrations/022_segment_headers.sql` (new)
- `backend/internal/models/memory.go`
- `backend/internal/memory/service.go`
- `backend/internal/review/service.go`
- `backend/internal/handlers/chat.go`
- `backend/internal/handlers/program.go`
- `backend/main.go`
- `frontend/src/services/api.ts`
- `frontend/src/hooks/useChatWebSocket.ts`
- `frontend/src/screens/HomeScreen.tsx`
