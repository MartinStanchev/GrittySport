# Chat Limit Switched to Monthly + Input Length Cap

## Why

Cost control. The chat limit was 40/week (~172/month worst case), which let a power user
or adversarial actor accumulate significant token spend on the free tier. Switched to a
monthly cap to better align with the rest of the free-tier limits (program creations,
post-workout reviews, missed-workout reviews are all monthly) and to make per-user worst
case predictable. New cap: **60 messages/month** (matches normal usage: ~30 for one
program creation flow + ~30 for coaching/edits before the upgrade prompt fires).

Also added an explicit per-message length cap so a single message can't smuggle in a
giant prompt.

## Changes

### Backend
- `backend/internal/usage/service.go`
  - `FreeChatMessagesPerWeek` → `FreeChatMessagesPerMonth = 60`.
  - `chat_message` resource now uses `period_type = "month"`; weekly path removed entirely
    from `computePeriodStart`.
  - `WeekResetTime()` → `MonthResetTime()`.
  - `GetUsage` collapsed: chat usage now read from the same monthly row as the other
    counters (single query instead of two).
  - `models` import dropped (no longer needed after weekly-window removal).
- `backend/internal/handlers/chat.go`
  - Rate-limited message: `"You've used your %d free messages this month. Resets on the 1st."`
  - New pre-quota validation: rejects messages over `sanitize.MaxChatMessageChars` (rune
    count) before incrementing the quota, so a too-long message doesn't burn a slot. Sends
    a typed `message_too_long` WS frame.
- `backend/internal/sanitize/sanitize.go`
  - Added `MaxChatMessageChars = 4000`. `SanitizeChatMessage` truncates to this value as
    defense-in-depth; primary enforcement is at the handler layer with explicit rejection
    (no more silent data loss for the user).
- `backend/internal/sanitize/sanitize_test.go`, `usage/service_test.go` — updated to the
  new constant names.

### Frontend
- `frontend/src/hooks/useChatWebSocket.ts`
  - Default copy: "this week" → "this month".
  - Added handler for new `message_too_long` WS frame (renders as a system message,
    doesn't trigger rate-limit lockdown).
- `frontend/src/screens/HomeScreen.tsx`
  - "X messages left this week" → "this month".
  - Rate-limit banner: "Resets Monday" → "Resets on the 1st".
- `frontend/src/screens/SettingsScreen.tsx`
  - Usage row: "X / Y this week" → "this month".

## Migration / data

No DB migration needed — `usage_tracking.chat_messages_used` already exists on monthly
rows. Existing weekly rows from the old window will sit unused until cleanup.

## Cost envelope (rough, per active free user / month)

At 60 messages with one full program creation flow (~30 of those messages) + ~30 coaching
messages, plus the existing review limits (5 post-workout, 5 missed):

- ~550k input + ~40k output tokens
- At Gemini 3 Flash $0.30 in / $2.50 out per 1M: **~$0.27/user/month** (≈ €0.25)
- Worst-case adversarial at 60 × 4k char input: ~1M input + 60k output ≈ **~$0.45/user/month**

Both well under the €1/user budget.

## Follow-up (deferred)

Program-context cap on memory assembly — a power user with a very large program currently
re-loads the whole program block into context per turn. Decision: handle smartly so the
user can still operate on a huge program. Pending design discussion before implementation.
