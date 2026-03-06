# Task 12: Post-Workout Review + Premium Statistics

## Summary
Added post-workout AI review service, premium workout analytics (effort score, per-km splits, program alignment, PR detection), missed workout scheduler, and analytics API endpoint.

## What was implemented

### Frontend
- **Types** (`types/gps.ts`): KmSplit, EffortScoreData, SplitsAnalysis, PersonalRecord, WorkoutAnalytics, ProgramAlignment, TrendComparison
- **Utility functions** (`services/gpsUtils.ts`): `computeEffortScore()` (TRIMP-based, 0-100), `computeKmSplits()` (per-km splits with HR averaging via two-pointer), `getEffortColor()`
- **`isPremium` helper** (`utils/premium.ts`): checks `subscription_tier === 'premium'`
- **New components**:
  - `PremiumStatsCard` — gating wrapper, blurred preview for free users
  - `EffortScoreCard` — circular gauge 0-100 with color coding
  - `SplitsCard` — per-km split bars with fastest/slowest highlighting
  - `ProgramAlignmentCard` — prescribed vs actual table with deviation %
  - `PRBadge` — "NEW PR" pill badge
- **WorkoutSummaryScreen** — premium analytics section (effort + splits), post-save auto-opens chat for Grit review
- **WorkoutDetailScreen** — fetches analytics from API (parallel with workout), renders full premium section
- **API** (`services/api.ts`): `getWorkoutAnalytics()` endpoint call

### Backend
- **Review service** (`review/service.go`): `TriggerReview()` (loads workout, computes deviation, calls Gemini, saves chat message), `TriggerMissedReview()`
- **Deviation helpers** (`review/deviation.go`): `ComputeEffortScore()`, `ComputeKmSplits()`, `ComputeRunDeviation()`, `ComputeStrengthDeviation()`, `ComputeGenericDeviation()`
- **Analytics** (`review/analytics.go`): `ComputeAnalytics()` — assembles effort, splits, alignment, trend, PRs
- **PR detection** (`review/records.go`): `DetectPersonalRecords()` — fastest 1km, longest distance, highest effort
- **Missed workout scheduler** (`review/scheduler.go`): hourly check, timezone-aware, premium-only
- **Gemini client** (`ai/gemini.go`): `GenerateContent()` for non-streaming generation
- **Workout handler**: async review trigger in goroutine with detached context, analytics endpoint with premium gate
- **Tier constant** (`usage/service.go`): `TierPremium`/`TierFree` constants replacing string literals
- **Prompts**: `post_workout_review.md`, `missed_workout_review.md`
- **Migration**: `011_add_missed_review_sent.sql`

## Key files changed
- `frontend/src/types/gps.ts`
- `frontend/src/services/gpsUtils.ts`
- `frontend/src/services/api.ts`
- `frontend/src/utils/premium.ts` (new)
- `frontend/src/components/PremiumStatsCard.tsx` (new)
- `frontend/src/components/EffortScoreCard.tsx` (new)
- `frontend/src/components/SplitsCard.tsx` (new)
- `frontend/src/components/ProgramAlignmentCard.tsx` (new)
- `frontend/src/components/PRBadge.tsx` (new)
- `frontend/src/screens/WorkoutSummaryScreen.tsx`
- `frontend/src/screens/WorkoutDetailScreen.tsx`
- `backend/internal/review/` (new package: service, deviation, analytics, records, scheduler)
- `backend/internal/ai/gemini.go`
- `backend/internal/handlers/workout.go`
- `backend/internal/usage/service.go`
- `backend/main.go`
- `backend/prompts/skills/post_workout_review.md` (new)
- `backend/prompts/skills/missed_workout_review.md` (new)
- `db/migrations/011_add_missed_review_sent.sql` (new)

## Code simplifier fixes applied
- Fixed goroutine context: use `context.Background()` with 30s timeout instead of `r.Context()`
- Removed duplicate `formatPace` in WorkoutDetailScreen (reuses `formatPaceSecPerKm` from gpsUtils)
- Fixed `as any` cast: narrowed `WorkoutAnalytics.effort_label` type to match `EffortScoreData['label']`
- Parallel API calls in WorkoutDetailScreen (Promise.all for workout + analytics)
- Memoized heavy computations in WorkoutSummaryScreen (useMemo for effort score + splits)
- Two-pointer HR averaging in `computeKmSplits` (O(K+H) instead of O(K*H))
- Reduced `DetectPersonalRecords` parameter sprawl (accepts `*models.Workout` + pre-computed effort score)
- Added `TierPremium`/`TierFree` constants replacing stringly-typed tier checks
- Used parameterized query for tier check in scheduler SQL

## Tests
- Go: 6 test functions in `review/deviation_test.go` — all passing
- Frontend: 91 total tests passing (including new gpsUtils tests for effort score, splits)
