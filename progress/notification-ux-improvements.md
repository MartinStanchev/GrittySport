# Notification UX Improvements

## What was built

- **Contextual titles** — push notifications now use activity-specific titles instead of always "Grit". Post-workout: `"Run review ready"`, missed: `"Missed your Strength"`, reminder: `"Run today"` / `"3 workouts today"`.
- **Structured post-workout review** — Gemini now returns `{notification_preview, review}` via JSON schema (`ResponseMIMEType: "application/json"` + `ResponseSchema`). The preview is a one-sentence, ≤80 char concrete observation about the workout (e.g. "Strong tempo, but pace dipped on the back half") used as the lock-screen body. Falls back to `"Tap to see how it went."` if the LLM returns malformed/oversized JSON.
- **Randomized missed-workout bodies** — 5 templated fallback strings, picked via `rand.IntN`, replacing the LLM-generated preview that was just truncated review text.
- **Tap-to-open-chat deep linking** — tapping `post_workout_review`, `missed_workout`, or `pre_workout_checkin` now opens the chat modal on Home (not just the Home screen). Tap handler calls `requestOpenChat()` from `ProgramContext` before navigating.
- **`Payload` struct for `SendToUser`** — the function now takes `notifications.Payload{Title, Body, Data}` instead of `(body, data)` positional args. Title falls back to registry's `DefaultTitle` if empty.

## Behaviour changes

- Post-workout review still saves Grit's full prose to the chat segment — only the notification body is templated.
- Missed-workout: same — full Grit message lives in chat, push body is now a randomized template (no LLM preview).
- Workout reminder: title and body are split (title = "{activity} today", body = specifics), formerly a single body string.

## Key files created

- `backend/internal/notifications/copy.go` — `FormatActivityLabel` + `PickMissedWorkoutBody` helpers + `missedWorkoutBodies` slice
- `backend/internal/notifications/copy_test.go` — coverage for the helpers
- `progress/notification-ux-improvements.md` — this file

## Key files modified

- `backend/internal/notifications/sender.go` — added `Payload` struct, changed `SendToUser` signature
- `backend/internal/review/service.go` — split `generateReview` into `generatePostWorkoutReview` (JSON-structured, Standard tier) and `generateMissedReview` (plain text, Flex tier). Added `postWorkoutReviewResponse`, `postWorkoutNotifBody`, `reviewContents` helper. Removed `truncatePreview`.
- `backend/internal/review/reminder.go` — split title/body, uses `FormatActivityLabel`
- `backend/prompts/review_post_workout.md` — added "Output Format" section instructing Gemini to return JSON with `notification_preview` and `review` fields
- `frontend/App.tsx` — moved `useNotifications` into a `NotificationsBridge` component inside `ProgramProvider` so the hook can access `useProgram()`
- `frontend/src/hooks/useNotifications.ts` — added `CHAT_OPEN_TYPES` set; tap handler calls `requestOpenChat()` for chat-driven types

## Failure modes handled

- Gemini returns invalid JSON → review uses raw text, preview empty → push body uses templated fallback
- Gemini returns JSON with empty `review` → falls back to raw text, keeps any preview
- Gemini returns preview > 80 chars → push body uses templated fallback (review still saved)
- Activity type unknown to `FormatActivityLabel` → snake_case is title-cased ("hiit" → "Hiit", "long_run" → "Long Run")
