# Time-Bound Reminders (Task 26)

User can ask Grit to remind them about something at a specific time
("remind me tomorrow morning to wear my new shoes", "remind me in 2 weeks
about deload"). Grit extracts the absolute datetime + writes the final
notification text, stores both, and a background scheduler delivers the
reminder as a chat message + push when the time arrives. **No LLM call on
the delivery hot path.**

## Flow

1. User: "Remind me tomorrow at 8am to wear my new shoes"
2. Grit calls `set_reminder(content, remind_at)` — `content` is the final
   user-facing string ("Don't forget your new shoes for the run today!"),
   `remind_at` is RFC 3339 with offset, resolved against the user's TZ
   already in the system prompt.
3. Grit acknowledges in the chat turn ("Got it — I'll ping you tomorrow at 8am").
4. `UserReminderChecker` ticks every minute, queries due reminders, inserts
   an assistant chat message with `content` verbatim, sends a push, and
   marks the row delivered.

## Decisions

- **Tool call, not segment summarization.** User needs immediate confirmation
  and reminders for "in 30 min" would miss the async summarization window.
- **Pre-rendered body.** Same `content` string is the chat message and push
  body — no second LLM call when the reminder fires.
- **1-minute tick.** Workout/missed-workout schedulers run hourly because
  they're date-grained; time-bound reminders need wall-clock precision. The
  partial index on `delivered = false` makes the per-tick query trivial.
- **No active-reminder cap.** Task spec suggested 5 free / 50 premium; the
  user explicitly opted out. Easy to add later if abuse shows up.
- **Reminders are tier-free.** No premium gating on the notification type
  itself — the trigger message already counts against the 60/month free
  chat cap, so abuse self-limits.
- **Best-effort mark-delivered.** If `UPDATE delivered = true` fails after
  the chat message is saved, the next tick re-delivers; the duplicate is
  rare and far better than swallowing the delivery silently.
- **Segment header.** Each delivery opens a `reminder_delivery` segment so
  any follow-up exchange groups under a "Reminder" header in the chat UI,
  consistent with post-workout / missed-workout segments.

## Tools added (all four modes)

- `set_reminder(content, remind_at)` — validates RFC 3339 + future-only,
  truncates `content` to 500 chars defensively.
- `list_reminders()` — undelivered, ordered by next-fire.
- `cancel_reminder(reminder_id)` — DELETE scoped to `(id, user_id, delivered = false)`
  so the same call collapses cross-user / already-delivered / unknown-id
  into a single `not_found` for the LLM.

## Notification type

Added `"reminder"` to `notifications.Registry` — free tier, default-disabled
per the existing GDPR pattern (each push channel is its own opt-in).

## Key files

| File | Action |
|------|--------|
| `db/migrations/030_user_reminders.sql` | Create — table + partial index on undelivered rows |
| `backend/internal/services/reminders.go` | Create — `ReminderService` (Create/ListActive/Cancel/ListDue/MarkDelivered) |
| `backend/internal/services/reminders_test.go` | Create — integration tests for CRUD + IDOR scoping |
| `backend/internal/review/user_reminder.go` | Create — `UserReminderChecker` (1-min ticker) |
| `backend/internal/notifications/types.go` | Modify — append `"reminder"` to Registry |
| `backend/internal/memory/service.go` | Modify — add `"reminder_delivery"` case to `formatSegmentType` |
| `backend/internal/tools/tools.go` | Modify — register three reminder tools |
| `backend/internal/tools/registry_test.go` | Modify — update tool counts (21 → 24) |
| `backend/internal/handlers/chat.go` | Modify — thread `ReminderService` through `NewChatHandler` |
| `backend/main.go` | Modify — instantiate service + start scheduler goroutine |
