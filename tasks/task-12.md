## Feature 12: Post-Workout Review and Program Adjustment

### Goal
After every saved or missed workout, Grit reviews performance and messages the user. If performance deviates significantly, Grit proposes program adjustments.

### Premium Gating (implemented in Task 11)
- **Free users**: 3 post-workout reviews per month (preview). Missed workout check-ins are premium-only.
- **Premium users**: Every workout gets a review, missed workout check-ins included.
- All user-provided text in prompts (workout notes, recorded data) must pass through `sanitize.SanitizeForPrompt()` from Task 11.
- Use `usage.CheckAndIncrement(ctx, userID, "post_workout_review")` before triggering a review for free users.

### Task 12.1: Post-Workout Review Trigger
- In the Go backend, create a `ReviewService` at `/internal/review/service.go`:
  - Exposes `TriggerReview(userID uuid, workoutID uuid)` and `TriggerMissedReview(userID uuid, activityID uuid)`
  - **For completed workouts**:
    1. Load the workout from DB (including `recorded_data`)
    2. Load the linked scheduled activity (if any) and its `prescription`
    3. Compute deviation metrics:
       - For runs/cycling: percentage difference in distance and pace vs prescription
       - For strength: percentage difference in total volume (sets × reps × weight) vs prescription
       - For other types: duration difference
    4. Load the user's last 5 completed workouts for trend context
    5. Assemble a `post_workout` system prompt for Grit:
       ```
       You are reviewing the user's workout. Here is the data:

       Scheduled Activity: {activity_type} — {prescription_summary}
       Actual Performance: {recorded_data_summary}
       Deviation: {deviation_metrics}

       Recent trend (last 5 workouts): {trend_summary}

       If the user met or exceeded targets, be enthusiastic and encouraging. Highlight specific achievements.
       If the user was 15%+ below targets on cardio metrics, or 20%+ below on strength volume, express concern constructively and ask if they need to adjust their program. Use the adjust_program tool if they agree.
       If the workout was partially completed, acknowledge what they did and ask about what was missed.
       Always be specific — reference actual numbers.
       Keep your message under 150 words.
       ```
    6. Call Gemini with this prompt (no user message needed — Grit initiates)
    7. Save Grit's message to `chat_messages` with `context: "post_workout"`
    8. Send a push notification with the first 100 characters of Grit's message
  - **For missed workouts**:
    1. Load the scheduled activity
    2. Assemble a prompt: "The user had a [activity_type] scheduled today but did not record it. It has been missed. Ask what happened. Be understanding but direct. Offer to adjust the program if needed."
    3. Same flow as above

### Task 12.2: Missed Workout Scheduled Job
- Create a cron-like scheduled job in the Go backend:
  - Runs every hour (not just at 21:00 — to handle different timezones)
  - For each user: check their timezone, determine if it's past 21:00 local time
  - Find scheduled activities for today (based on the user's timezone and the activity's day_of_week + week start_date) that have no corresponding workout in the `workouts` table
  - For each missed activity: call `TriggerMissedReview`
  - Track which activities have already been flagged as missed (add a `missed_review_sent` boolean column to `scheduled_activities` to avoid duplicate notifications):
    ```sql
    ALTER TABLE scheduled_activities ADD COLUMN missed_review_sent BOOLEAN DEFAULT FALSE;
    ```

### Task 12.3: Post-Workout Chat Display
- When the app receives a push notification for a post-workout review:
  - Tapping the notification opens the app and expands the chat overlay
  - The chat shows Grit's review message
- Also: on app foreground, check for new `post_workout` messages in `GET /api/chat/history?context=post_workout` that haven't been displayed yet. Show a badge on the chat bar if there are unread Grit messages.
- In the chat, if Grit proposes an adjustment and the user agrees:
  - Grit calls `adjust_program` via MCP
  - The client receives a `tool_call` message for `adjust_program`
  - On completion, show an inline confirmation: "✅ Program updated"
  - The Home screen upcoming activities refresh to reflect changes

### How to Test
- Complete a run that is 20% shorter than prescribed → save → within seconds, a push notification arrives with Grit's message
- Open the chat → Grit references the specific distance shortfall and asks if you need to adjust
- Reply "Yes, I've been struggling with the distance" → Grit calls adjust_program → upcoming sessions are modified
- Let a scheduled workout pass without recording → at 21:00 in your timezone, a push notification arrives → Grit asks what happened
- Reply explaining you were sick → Grit offers to reschedule the week

---