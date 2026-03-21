# Task 23: Memory Decay - Background Expiry + Fact Cap

## Summary
Prevent unbounded fact growth for long-term users by adding type-based auto-expiry and capping the number of facts injected into the system prompt.

## Context
The `chat_facts` table accumulates facts over time. For a user active for 1+ year, this could grow to 30-50+ active facts. Stale facts (e.g., a healed injury from 8 months ago) waste tokens and can cause the model to give outdated advice. Currently there is no mechanism to age out or limit facts.

## Requirements

### Type-based auto-expiry
Add a background job (daily, using the existing scheduler pattern in `main.go`) that deactivates stale facts:

| Fact Type | Expiry Period | Rationale |
|-----------|--------------|-----------|
| `injury` | 4 months | Injuries heal |
| `health_condition` | 4 months | Conditions change |
| `schedule_constraint` | 3 months | Schedules shift |
| `goal` | No expiry | Persist until replaced by newer goal |
| `sport_focus` | No expiry | Persist until replaced |
| `equipment` | No expiry | Persist until replaced |
| `preference` | No expiry | Persist until replaced |

Implementation: Simple SQL queries run periodically:
```sql
UPDATE chat_facts SET active = false, updated_at = NOW()
WHERE fact_type IN ('injury', 'health_condition')
  AND created_at < NOW() - INTERVAL '4 months'
  AND active = true;

UPDATE chat_facts SET active = false, updated_at = NOW()
WHERE fact_type = 'schedule_constraint'
  AND created_at < NOW() - INTERVAL '3 months'
  AND active = true;
```

### Fact cap in assembly
- Update `GetActiveFacts` (or the query in `AssembleMemory`) to limit results to the 20 most recent active facts
- Order by `created_at DESC` so newest facts are always included
- This is a safety net for edge cases where many non-expiring facts accumulate

### Background job
- Add a `RunFactDecay` function to the memory service
- Schedule it to run once daily (can reuse the existing ticker/scheduler pattern from `review/scheduler.go`)
- Log how many facts were deactivated per run

## Files to modify
- `backend/internal/memory/service.go` - Add `RunFactDecay()`, update `GetActiveFacts` query with LIMIT
- `backend/main.go` - Register the daily decay job in the startup scheduler

## Dependencies
- None. Can be implemented independently of Tasks 18-22.
