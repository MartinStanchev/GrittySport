# Memory Decay (Task 23)

Prevents unbounded fact growth by adding type-based auto-expiry and capping facts injected into the system prompt.

## What was built

### Type-based auto-expiry (`RunFactDecay`)
- `injury` and `health_condition` facts: deactivated after 4 months
- `schedule_constraint` facts: deactivated after 3 months
- `goal`, `sport_focus`, `equipment`, `preference`: no expiry (persist until replaced)
- Pure SQL, no LLM calls

### Fact cap
- `GetActiveFacts` now returns at most 20 facts (`ORDER BY created_at DESC LIMIT 20`)
- Newest facts always included; safety net for edge cases with many non-expiring facts

### Background scheduler
- `FactDecayScheduler` runs on a 24-hour ticker (same pattern as `MissedWorkoutChecker`)
- Logs number of deactivated facts per run
- Registered as a goroutine in `main.go`

## Key files changed
- `backend/internal/memory/service.go` — added `RunFactDecay`, updated `GetActiveFacts` query
- `backend/internal/memory/scheduler.go` (new) — `FactDecayScheduler`
- `backend/main.go` — registered scheduler

## Expected impact
- Long-term users won't accumulate stale injury/schedule facts in their prompt
- Fact token count capped at ~20 facts regardless of account age
- Zero additional latency or LLM calls
