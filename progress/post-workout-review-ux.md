# Post-Workout Review UX

Inline post-workout review widget shown at the bottom of each save screen after a workout is saved. Grit's AI review appears in-place with quick-reply and continue-in-chat. Works across all 4 workout save flows.

## What changed

### Backend
- **`review/service.go`**: Attach `{"workout_id": "..."}` metadata to review messages so they can be queried by workout
- **`handlers/workout.go`**: New `GET /workouts/{workoutId}/review` endpoint — returns `pending` or `ready` with the review message
- **`handlers/chat.go`**: New `POST /chat/messages` endpoint — REST-based message send for quick-reply without WebSocket
- **`main.go`**: Registered both new routes
- **`db/migrations/019_index_chat_metadata_workout.sql`**: Partial index on `metadata->>'workout_id'` for query performance

### Frontend
- **`components/PostWorkoutReview.tsx`** (new): Lightweight embeddable widget with state machine (polling -> ready -> replied -> timeout). Polls review endpoint every 2s, max 30s. Pulsing dot animation, quick-reply TextInput, "Continue in Chat" button.
- **`services/api.ts`**: Added `getWorkoutReview()` and `sendChatMessage()` API functions
- **`screens/WorkoutSummaryScreen.tsx`**: GPS flow — after save, replaces Save/Discard buttons with review widget at bottom. GPS workout data cleared on unmount via ref+effect.
- **`screens/WorkoutFilePreviewScreen.tsx`**: File import flow — after save, replaces Save/Cancel buttons with review widget
- **`screens/ImportScreen.tsx`**: Apple Health flow — after import, hides link/import buttons, shows review widget below summary in the bottom sheet
- **`screens/LogActivityScreen.tsx`**: Manual log flow — after save, replaces Save button with review widget
- **`screens/HomeScreen.tsx`**: Reset `historyLoaded` on `openChatRequest` so chat re-fetches messages (review + reply visible)
- **Deleted `PostWorkoutReviewBanner.tsx`** — unused stub replaced by the new component

## Key decisions
- Widget approach (not full-screen takeover): user sees their workout summary and the Grit review appears at the bottom, replacing the action buttons
- Polling over WebSocket push: simpler, no new WS event needed, 30s timeout gracefully falls back
- REST `POST /chat/messages` for quick-reply: avoids requiring WS connection just for one message
- GPS workout cleared on unmount (not on save) so summary data stays visible while review loads
- Removed link-to-activity Alert dialogs from all save flows (linking already happens via `scheduled_activity_id` at save time)
