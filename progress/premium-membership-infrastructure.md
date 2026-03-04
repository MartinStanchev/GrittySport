# Task 11: Premium Membership Infrastructure & Usage Limits

## Summary
Introduced free/premium tier system with usage limits, input sanitization, and gating infrastructure. No payment provider yet — tier is toggled manually in DB.

## What was built

### Database
- Migration `010_premium_tier.sql`: adds `subscription_tier`, `subscription_started_at`, `subscription_expires_at` to users; creates `usage_tracking` table with composite unique on `(user_id, period_type, period_start)`

### Backend — Usage Service (`internal/usage/`)
- `GetTier(ctx, userID)` — returns "free" or "premium" (expired premium → free)
- `CheckAndIncrement(ctx, userID, resource)` — atomic check+increment with `SELECT FOR UPDATE`, fails open on DB errors
- `GetUsage(ctx, userID)` — returns full usage summary (chat, programs, reviews, counts)
- `CanCreateProgram(ctx, userID)` — encapsulated tier+count check (used in 3 places)
- `CountUserPrograms(ctx, userID)` — simple count query
- Constants: `FreeChatMessagesPerWeek=50`, `FreeProgramCreationsPerMonth=2`, `FreePostWorkoutReviewsPerMonth=3`, `FreeProgramsTotal=1`

### Backend — Input Sanitization (`internal/sanitize/`)
- `SanitizeForPrompt(input, maxLen)` — strips control chars, escapes triple backticks, neutralizes prompt boundaries (`system:`, `user:`, `assistant:`), truncates
- `SanitizeWorkoutNotes(notes)` — 500 char limit wrapper
- `SanitizeChatMessage(msg)` — 2000 char limit wrapper
- Integrated in chat WS handler for user messages and user name in system prompt

### Backend — Handler Changes
- **ChatHandler**: rate limits user messages (50/week for free), sends `rate_limited` WS frame when denied, includes `usage_remaining`/`usage_limit` in `grit_chunk done` frames
- **ProgramHandler.Create**: blocks free users at 1 program with 403 `free_tier_limit`
- **Tools**: `create_draft_program` and `confirm_program_save` check program limit via `CanCreateProgram()`
- **UserHandler**: new `GetUsage` method → `GET /api/v1/users/me/usage`
- **UserResponse**: now includes `subscription_tier` and `subscription_expires_at`

### Frontend
- **api.ts**: added `subscription_tier`/`subscription_expires_at` to `UserResponse`, added `UsageSummary` types and `getUsage()` function
- **usageService.ts**: re-exports from api.ts
- **useUsage hook**: fetches usage data with refresh callback
- **useChatWebSocket**: handles `rate_limited` frame type, tracks `usageRemaining`/`usageLimit` from done frames
- **HomeScreen**: shows usage counter when <=15 messages left, replaces chat input with rate limit banner + upgrade CTA when rate limited
- **CreateProgramReviewScreen**: catches 403 `free_tier_limit` with upgrade dialog
- **SettingsScreen**: subscription section showing tier badge, usage stats, upgrade button
- **PostWorkoutReviewBanner**: stub component for Task 12 integration

## Key files changed
- `db/migrations/010_premium_tier.sql` (new)
- `backend/internal/usage/service.go` (new)
- `backend/internal/usage/service_test.go` (new)
- `backend/internal/sanitize/sanitize.go` (new)
- `backend/internal/sanitize/sanitize_test.go` (new)
- `backend/internal/models/user.go`
- `backend/internal/services/auth.go`, `user.go`
- `backend/internal/handlers/chat.go`, `program.go`, `user.go`
- `backend/internal/tools/tools.go`
- `backend/main.go`
- `frontend/src/services/api.ts`, `usageService.ts` (new)
- `frontend/src/hooks/useUsage.ts` (new), `useChatWebSocket.ts`
- `frontend/src/screens/HomeScreen.tsx`, `SettingsScreen.tsx`, `CreateProgramReviewScreen.tsx`
- `frontend/src/components/PostWorkoutReviewBanner.tsx` (new)

## Deviations from plan
- Used `CanCreateProgram()` helper instead of inline tier+count checks (code simplifier improvement)
- Reused `models.MondayOf()` for week period start instead of duplicating logic
- Frontend `usageService.ts` re-exports from `api.ts` instead of duplicating fetch logic
- Rate limit check runs before sanitization for efficiency
