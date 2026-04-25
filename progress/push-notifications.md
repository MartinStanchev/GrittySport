# Push Notifications

## What was built
- Dynamic notification type registry — adding a new notification = one registry entry + one `SendToUser` call
- Expo Push API sender with preference checks, premium gating, and invalid token cleanup
- Notification preference storage (per-type, not columns on users table)
- Push token registration (upsert, per-device, auto-cleanup of DeviceNotRegistered tokens)
- Integration with existing post-workout review and missed workout check-in flows
- Workout reminder scheduler (7-9 AM local time, free for all users)
- Frontend: `expo-notifications` setup, permission request, token registration on login
- Frontend: dynamic notification preferences in Settings (toggles fetched from backend registry)
- Frontend: notification tap handling — all types navigate to Home

## Notification types in registry
| Key | Label | Premium | Default |
|-----|-------|---------|---------|
| `workout_reminder` | Workout Reminders | No | Enabled |
| `post_workout_review` | Post-Workout Reviews | Yes | Enabled |
| `missed_workout` | Missed Workout Check-Ins | Yes | Enabled |
| `pre_workout_checkin` | Pre-Workout Check-Ins | Yes | Enabled |

Note: `pre_workout_checkin` is registered but no scheduler triggers it yet — deferred to a future task.

## Key files created
- `db/migrations/021_push_notifications.sql` — push_tokens + notification_preferences tables + reminder_sent_date
- `backend/internal/notifications/types.go` — notification type registry
- `backend/internal/notifications/sender.go` — Expo Push API sender service
- `backend/internal/notifications/types_test.go` — registry tests
- `backend/internal/handlers/notification.go` — HTTP handler (token CRUD, types listing, preference updates)
- `backend/internal/review/reminder.go` — workout reminder scheduler
- `frontend/src/hooks/useNotifications.ts` — registration + tap handling hook

## Key files modified
- `backend/internal/review/service.go` — added notifService, sends push after reviews
- `backend/main.go` — wires notification service, handler, and reminder scheduler
- `frontend/app.json` — added expo-notifications plugin
- `frontend/App.tsx` — integrated useNotifications hook
- `frontend/src/services/api.ts` — added notification API functions
- `frontend/src/screens/SettingsScreen.tsx` — dynamic notification preference toggles

## API endpoints
- `POST /api/v1/devices/push-token` — register push token
- `DELETE /api/v1/devices/push-token` — remove push token
- `GET /api/v1/notifications/types` — list all types with user's preferences
- `PUT /api/v1/notifications/preferences/{type}` — update one preference

## Deferred: Pre-Workout Check-In (Task 14.4)
The pre-workout check-in feature (pattern detection, scheduler, prompt) is deferred to a separate task.
