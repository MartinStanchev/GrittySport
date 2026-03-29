# Context-Aware Automated Reviews

## Summary
Automated post-workout and missed-workout reviews now include user memory (chat facts + recent session summaries) and active program context (name, sport, goal, criteria). Previously, these reviews were generated in isolation with only workout data — Grit had no awareness of injuries, preferences, goals, or program settings until the user replied.

## Changes

### `backend/internal/review/service.go`
- Added `assembleUserMemory(ctx, userID)` — calls `memoryService.AssembleMemory` with `workout_review` mode, returns fallback text if empty
- Added `buildProgramContext(ctx, userID)` — queries active program (name, sport, goal) + criteria from DB, formats as structured text
- `TriggerReview` now injects `{{.UserMemory}}` and `{{.ProgramContext}}` into the review prompt
- `TriggerMissedReview` now injects the same two variables into the missed review prompt

### `backend/prompts/review_post_workout.md`
- Added "What You Know About This User" section with `{{.UserMemory}}`
- Added "Active Program" section with `{{.ProgramContext}}`
- Added instruction #5: consider user context (injuries, goals, preferences) in feedback

### `backend/prompts/review_missed_workout.md`
- Added "What You Know About This User" section with `{{.UserMemory}}`
- Added "Active Program" section with `{{.ProgramContext}}`
- Added instruction #2: if injury/schedule constraint might explain the miss, acknowledge it instead of blindly asking

## Key decisions
- Used direct DB queries in `buildProgramContext` (review service already has `pool`) rather than adding `programService` dependency
- Fallback strings ("No prior context available.", "No active program.") give the LLM explicit signal rather than blank sections
- No constructor or wiring changes — review service already had `memoryService` and `pool`
- Token cost is ~700 extra per review (facts + criteria) — negligible given reviews are infrequent
