# Skip passive activity types in workout reminders + missed-workout reviews

Users were getting push notifications for rest days. Two flows pull from
`scheduled_activities`:

- **Morning workout reminders** (`backend/internal/review/reminder.go`) — fires
  7-9am local for the day's scheduled activity.
- **Missed-workout reviews** (`backend/internal/review/scheduler.go`) — fires
  after 9pm local if a scheduled activity has no linked workout.

Both flows already correctly required a *scheduled* activity (joining
`scheduled_activities`, not just looking for absence of logged workouts). The
gap was that they had no `activity_type` filter, so `rest`/`recovery`/`mobility`/
`yoga` rows triggered notifications just like real workouts.

## Fix

Added `notifications.PassiveActivityTypes = []string{"rest", "recovery", "mobility", "yoga"}`
and threaded it into both SQL lookups via `sa.activity_type <> ALL($N::text[])`.
Also added the same clause to the reminder.go `UPDATE` that stamps
`reminder_sent_date`, so the flag-set is symmetric with the SELECT.

`recovery` and `yoga` go alongside `rest` and `mobility` because they're
restorative in the same way — missing one doesn't warrant a push.

## Key files

- `backend/internal/notifications/copy.go` — `PassiveActivityTypes` constant.
- `backend/internal/review/reminder.go` — SELECT + UPDATE both filter passive.
- `backend/internal/review/scheduler.go` — missed-review SELECT filters passive;
  imports `notifications`.

## Not changed

- `backend/internal/services/reminders.go` and
  `backend/internal/review/user_reminder.go` handle *user-set* reminders via the
  `set_reminder` tool — unrelated to scheduled-activity-driven flows.
- `review/service.go` `TriggerMissedReview` still accepts any activity type. The
  caller (`scheduler.go`) is the only automated entry point and now filters
  upstream; manual triggers via `/trigger-review` remain unrestricted by design.
