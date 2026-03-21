## Feature 14: Push Notifications & Pre-Workout Check-Ins

### Goal
Users receive push notifications for Grit-initiated messages (post-workout reviews, missed workout check-ins, pre-workout check-ins) and workout reminders. Grit learns when users typically train and proactively checks in before workouts to ask about energy levels, sleep, and offer adjustments. Notifications are individually toggleable.

### Premium Gating
- **Free users**: Basic workout reminders only (daily morning notification if there's an activity scheduled).
- **Premium users**: Full access — workout reminders, Grit message notifications, and pre-workout check-ins.
- Uses existing `subscription_tier` check via `usage.Service.GetTier()`.

---

### Task 14.1: Expo Push Notification Setup

This is an Expo managed workflow project — use `expo-notifications` (not Firebase directly). Expo Push Service handles APNs/FCM routing behind the scenes.

**Frontend:**
- Install `expo-notifications` and `expo-device`
- Add `expo-notifications` to `app.json` plugins:
  ```json
  ["expo-notifications", { "icon": "./assets/notification-icon.png", "color": "#1a1a2e" }]
  ```
- iOS: Configure APNs key in Expo dashboard (or EAS credentials)
- Android: Add `google-services.json` to project root and configure in `app.json`

**Backend — migration `019_push_tokens.sql`:**
```sql
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_push_tokens_user_token ON push_tokens(user_id, token);
```

**Backend — endpoint `POST /api/v1/devices/push-token`:**
- Body: `{ "token": "ExponentPushToken[xxx]", "platform": "ios|android" }`
- Upserts: if token exists for this user, update `updated_at`. If new, insert.
- Auth required (extract user_id from JWT).

---

### Task 14.2: Client-Side Notification Registration

**On app launch (after auth):**
- Request notification permissions via `Notifications.requestPermissionsAsync()`
- Get Expo Push Token via `Notifications.getExpoPushTokenAsync({ projectId })`
- Send token to `POST /api/v1/devices/push-token`
- Listen for token changes and re-register

**Notification handling:**
- **Foreground**: Show an in-app banner/toast (not a system notification) using `Notifications.setNotificationHandler`
- **Background/tap**: Use `Notifications.addNotificationResponseReceivedListener` to handle taps. Based on `data` payload:
  - `type: "grit_message"` → open the chat modal
  - `type: "workout_reminder"` → navigate to Home screen
  - `type: "pre_workout_checkin"` → open the chat modal (Grit's check-in message is already in chat)

---

### Task 14.3: Backend Notification Sending

**Create `backend/internal/notifications/sender.go`:**
- Uses Expo Push API (simple HTTP POST to `https://exp.host/--/api/v2/push/send`)
- No external SDK needed — just `net/http` with JSON payload
- Exposes `SendToUser(ctx, pool, userID, title, body string, data map[string]string) error`:
  1. Looks up all push tokens for the user from `push_tokens` table
  2. Checks notification preferences (query user's `notify_*` columns)
  3. Checks premium gating via `usage.Service.GetTier()`
  4. Sends notification to each token via Expo Push API
  5. Handles errors: if token is `DeviceNotRegistered`, delete it from DB
- Exposes `SendBatch(ctx, messages []ExpoPushMessage) error` for bulk sends

**Expo Push API payload format:**
```json
{
  "to": "ExponentPushToken[xxx]",
  "title": "Grit",
  "body": "Great run today! I have some thoughts on your pacing.",
  "data": { "type": "grit_message" },
  "sound": "default"
}
```

**Integrate with existing features:**
- `review.Service.TriggerReview()` — after saving the review message, call `SendToUser` with type `grit_message` and a short preview of the review
- `review.Service.TriggerMissedReview()` — after saving the missed review message, call `SendToUser` with type `grit_message`
- Both in `backend/internal/review/service.go`

---

### Task 14.4: Pre-Workout Check-In (Premium Feature)

This is the intelligent, pattern-learning feature where Grit proactively reaches out before workouts.

**Pattern Detection — `backend/internal/review/patterns.go`:**
- Query recent workouts (last 4-8 weeks) grouped by day of week:
  ```sql
  SELECT EXTRACT(DOW FROM started_at AT TIME ZONE u.timezone) AS dow,
         AVG(EXTRACT(HOUR FROM started_at AT TIME ZONE u.timezone)) AS avg_hour,
         COUNT(*) AS count
  FROM workouts w
  JOIN users u ON u.id = w.user_id
  WHERE w.user_id = $1
    AND w.started_at > NOW() - INTERVAL '8 weeks'
  GROUP BY dow
  HAVING COUNT(*) >= 2
  ```
- Returns a map of `day_of_week → typical_hour` for days with enough data (>=2 workouts)
- Cross-reference with today's `scheduled_activities` to confirm there IS a planned workout

**Scheduler — `backend/internal/review/precheckin.go`:**
- New goroutine: `PreWorkoutChecker` with `time.NewTicker(15 * time.Minute)`
- Every 15 minutes:
  1. Find users with active programs + timezone set + premium tier
  2. For each user, compute their local time
  3. Check if user has a scheduled activity today
  4. Look up their typical training hour for today's day-of-week
  5. If current local time is 2-3 hours before typical training time AND no check-in sent today → trigger
  6. Fallback: if no pattern detected but activity is scheduled, send a simpler reminder at 9 AM local time (this replaces the basic reminder from the old task 14.4)

**Check-In Generation — `backend/internal/review/service.go`:**
- New method: `TriggerPreWorkoutCheckin(ctx, userID, activityID string) error`
  - Loads scheduled activity prescription + phase info
  - Loads recent workout trend (fatigue indicators: effort scores from last 3 days)
  - Builds prompt from a new skill file `backend/prompts/skills/pre_workout_checkin.md`
  - Template variables: `{{.UserName}}`, `{{.ActivityType}}`, `{{.PrescriptionSummary}}`, `{{.RecentEffortContext}}`, `{{.TimeOfDay}}`
  - Grit asks about: energy levels, sleep quality, any soreness/tightness, and offers to adjust today's session
  - Saves message to `chat_messages` (role="assistant")
  - Starts a `pre_workout_checkin` memory segment
  - Sends push notification with type `pre_workout_checkin`

**Tracking — migration `019_push_tokens.sql` (same migration):**
```sql
ALTER TABLE scheduled_activities
  ADD COLUMN reminder_sent_date DATE,
  ADD COLUMN checkin_sent_date DATE;
```
- `reminder_sent_date`: tracks basic daily reminders (free tier)
- `checkin_sent_date`: tracks pre-workout check-ins (premium)

**Usage tracking:**
- Add `pre_workout_checkin` resource to `usage.Service` — premium only (free users get 0)

---

### Task 14.5: Notification Preferences

**Migration `020_notification_preferences.sql`:**
```sql
ALTER TABLE users
  ADD COLUMN notify_workout_reminders BOOLEAN DEFAULT TRUE,
  ADD COLUMN notify_grit_messages BOOLEAN DEFAULT TRUE,
  ADD COLUMN notify_pre_workout BOOLEAN DEFAULT TRUE;
```

**Settings screen (`frontend/src/screens/SettingsScreen.tsx`):**
- Add "Notifications" section with toggles:
  - "Workout Reminders" — daily reminder when you have a scheduled activity
  - "Grit Messages" — post-workout reviews, missed workout check-ins
  - "Pre-Workout Check-Ins" — Grit checks in before your workouts (premium badge)
- Premium users see all toggles. Free users see "Workout Reminders" only; other toggles show a premium lock icon.

**Backend:**
- Update `PUT /api/v1/users/me` to accept `notify_workout_reminders`, `notify_grit_messages`, `notify_pre_workout`
- Notification sender checks these preferences before sending

---

### Pre-Workout Check-In Prompt Design (`backend/prompts/skills/pre_workout_checkin.md`)

Grit should:
- Reference the specific workout planned for today (e.g., "You've got a tempo run on the plan today")
- Ask about energy/sleep/soreness in a conversational way (not a form)
- Reference recent training load if relevant (e.g., "You had a tough strength session yesterday")
- Offer to adjust today's session if the user isn't feeling great
- Keep it short and supportive — this is a quick check-in, not a lecture

---

### Key Files to Modify/Create

| File | Action |
|------|--------|
| `db/migrations/019_push_tokens.sql` | Create — push_tokens table + scheduled_activities columns |
| `db/migrations/020_notification_preferences.sql` | Create — user notification preference columns |
| `backend/internal/notifications/sender.go` | Create — Expo Push API sender |
| `backend/internal/review/patterns.go` | Create — workout timing pattern detection |
| `backend/internal/review/precheckin.go` | Create — pre-workout check-in scheduler |
| `backend/internal/review/service.go` | Modify — add TriggerPreWorkoutCheckin, integrate notifications into TriggerReview/TriggerMissedReview |
| `backend/internal/review/scheduler.go` | Modify — possibly consolidate scheduler patterns |
| `backend/internal/usage/service.go` | Modify — add pre_workout_checkin resource |
| `backend/main.go` | Modify — init notification sender, start PreWorkoutChecker goroutine |
| `backend/prompts/skills/pre_workout_checkin.md` | Create — check-in prompt template |
| `frontend/package.json` | Modify — add expo-notifications, expo-device |
| `frontend/app.json` | Modify — add expo-notifications plugin |
| `frontend/App.tsx` | Modify — notification registration + handlers |
| `frontend/src/screens/SettingsScreen.tsx` | Modify — notification preference toggles |
| `frontend/src/services/api.ts` | Modify — add push token registration endpoint |

### How to Test
- Enable notifications when prompted on app launch
- With a workout scheduled today: receive a reminder notification in the morning
- Record a workout: receive a push notification with Grit's review preview → tap to open chat
- Miss a scheduled workout: receive a push notification at 9 PM with Grit's check-in
- (Premium) Train consistently at 6 PM on Wednesdays for 2+ weeks → receive a pre-workout check-in around 3-4 PM on Wednesday asking about energy/sleep
- Go to Settings → Notifications → toggle individual notification types off → verify they stop
- Uninstall/reinstall app → token re-registers on login

---
