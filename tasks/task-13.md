## Feature 13: Push Notifications

### Goal
Users receive push notifications for workout reminders, Grit messages, and import prompts. Notifications are individually toggleable.

### Task 13.1: FCM Setup
- Create a Firebase project for Gritty Fitness
- Install `@react-native-firebase/app` and `@react-native-firebase/messaging` in the React Native project
- Configure iOS: add `GoogleService-Info.plist` to the Xcode project, enable Push Notifications capability, configure APNs key in Firebase Console
- Create migration `008_create_fcm_tokens.sql`:
  ```sql
  CREATE TABLE fcm_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE UNIQUE INDEX idx_fcm_tokens_user_token ON fcm_tokens(user_id, token);
  ```
- Implement `POST /api/devices/fcm-token`:
  - Body: `{ "token": "string", "platform": "ios|android" }`
  - Upserts: if a token already exists for this user, update `updated_at`. If new, insert.

### Task 13.2: Client-Side Notification Registration
- On app launch (after successful authentication), request notification permission via `@react-native-firebase/messaging`
- Get the FCM token and send it to `POST /api/devices/fcm-token`
- Listen for token refreshes and re-register
- Handle foreground notifications: show an in-app banner (not a system notification) using a custom toast component
- Handle background notifications: tapping the notification opens the app. Based on notification data payload:
  - `type: "workout_reminder"` → navigate to Activity Detail screen for the specified activity
  - `type: "grit_message"` → open the chat overlay
  - `type: "garmin_import"` → navigate to Import Activity screen

### Task 13.3: Backend Notification Sending
- Create a `/internal/notifications/sender.go` module:
  - Uses the Firebase Admin Go SDK (`firebase.google.com/go/v4/messaging`)
  - Exposes `SendToUser(userID, title, body string, data map[string]string)`:
    - Looks up all FCM tokens for the user
    - Sends the notification to each token
    - If a token returns `messaging.ErrRegistrationTokenNotRegistered`, delete it from the DB
- Integrate notifications with:
  - Post-workout review (Feature 11): already done — sends Grit's message
  - Garmin webhook (Feature 10): already done — sends import prompt
  - Workout reminder: new scheduled job (next task)

### Task 13.4: Workout Reminder Job
- Create a scheduled job that runs every 15 minutes:
  - For each user: check timezone, find scheduled activities for today that start within the next 30 minutes (approximate based on day_of_week and typical time the user trains — since we don't have exact times, send the reminder at 7:00 AM in the user's timezone for the day's first activity)
  - Actually: since scheduled activities only have a day_of_week and not a specific time, send one reminder per day at 8:00 AM local time if there's a scheduled activity for that day.
  - Track sent reminders to avoid duplicates (add `reminder_sent_date DATE` column to `scheduled_activities`)
  - Notification: "You have [Activity Type] on the plan today. Let's go! 💪"

### Task 13.5: Notification Preferences
- Add to users table (migration `009_notification_preferences.sql`):
  ```sql
  ALTER TABLE users
    ADD COLUMN notify_workout_reminders BOOLEAN DEFAULT TRUE,
    ADD COLUMN notify_grit_messages BOOLEAN DEFAULT TRUE,
    ADD COLUMN notify_import_prompts BOOLEAN DEFAULT TRUE;
  ```
- Update Settings screen to show toggles for each notification type under a "Notifications" section
- Update `PUT /api/users/me` to accept these fields
- All notification sending checks the user's preferences before sending

### How to Test
- Enable notifications when prompted
- With a workout scheduled today: receive a reminder notification at 8 AM local time
- Record a workout: receive a post-workout message from Grit
- Tap the notification: app opens to the chat with Grit's review
- Go to Settings → Notifications → turn off "Workout Reminders" → no more morning reminders
- Connect Garmin, upload a workout → receive import notification

---