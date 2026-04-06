## Feature 26: Time-Bound Reminders

### Goal
Users can ask Grit to remind them about something at a specific time (e.g., "Remind me to buy new running shoes next Monday", "Remind me about deload week in 2 weeks"). Grit extracts the date/time and schedules a reminder that is delivered as a chat message + push notification.

### Dependency
Requires **Task 14** (Push Notifications) for notification delivery. Can be partially implemented (DB + tool + chat-message-only delivery) before Task 14 is complete.

### Premium Gating
- **Free users**: Up to 5 active (undelivered) reminders
- **Premium users**: Up to 50 active reminders
- Creating a reminder counts toward the user's 40 free weekly chat messages (the message that triggers the reminder)

---

### Task 26.1: Database Schema

**Migration `0XX_user_reminders.sql`:**
```sql
CREATE TABLE user_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    remind_at TIMESTAMPTZ NOT NULL,
    delivered BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_reminders_pending ON user_reminders(user_id, delivered, remind_at)
    WHERE delivered = false;
```

---

### Task 26.2: Tool — `set_reminder`

**Available in all modes.**

Parameters:
- `content` (string, required): What to remind the user about
- `remind_at` (string, required): ISO 8601 datetime for the reminder (Grit converts natural language like "next Monday" to an absolute date using the user's timezone)

Handler:
1. Parse `remind_at` as time
2. Validate it's in the future
3. Check active reminder count against tier limit (5 free / 50 premium)
4. Insert into `user_reminders`
5. Return confirmation with the scheduled date

---

### Task 26.3: Reminder Delivery Scheduler

**`backend/internal/review/reminder.go`:**
- `ReminderChecker` goroutine with `time.NewTicker(5 * time.Minute)`
- Every tick:
  1. Query `user_reminders` where `delivered = false AND remind_at <= NOW()`
  2. For each due reminder:
     - Insert a chat message (role=`assistant`) with the reminder content, prefixed with context (e.g., "You asked me to remind you: ...")
     - Send push notification via `notifications.SendToUser` (type `reminder`) — if Task 14 is implemented
     - Mark `delivered = true`

---

### Task 26.4: Tool — `list_reminders` (optional)

Allow Grit to show active reminders when the user asks "what reminders do I have?" Parameters: none. Returns active reminders with dates.

### Task 26.5: Tool — `cancel_reminder`

Allow user to cancel a pending reminder. Parameters: `reminder_id` or `content` (fuzzy match). Deletes or marks as delivered.

---

### Key Files to Create/Modify

| File | Action |
|------|--------|
| `db/migrations/0XX_user_reminders.sql` | Create — reminders table |
| `backend/internal/tools/tools.go` | Modify — add `set_reminder`, optionally `list_reminders`, `cancel_reminder` |
| `backend/internal/review/reminder.go` | Create — `ReminderChecker` scheduler |
| `backend/main.go` | Modify — start `ReminderChecker` goroutine |
| `backend/internal/usage/service.go` | Modify — add `FreeRemindersTotal` constant |

### How to Test
- Ask Grit "Remind me to buy new shoes on Monday" → confirm it saves with correct date
- Wait for the scheduled time → receive chat message + push notification
- Ask "What reminders do I have?" → see pending reminders
- Ask "Cancel the shoes reminder" → confirm it's removed
- Free user: create 5 reminders → 6th should be blocked
