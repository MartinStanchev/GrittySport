# Task 17: Configurable Weekly Effort Goal

## Summary
Allow users and Grit to configure the weekly effort goal (currently hardcoded at 300).

## Requirements

### User-configurable
- Add a "Weekly Effort Goal" setting in the Settings screen
- Store the goal in the `users` table (new column `weekly_effort_goal INTEGER DEFAULT 300`)
- Expose via the profile/settings API (`GET/PUT /api/v1/profile`)

### Grit-configurable
- Add a tool call for Grit to set the weekly effort goal based on the active program
- Grit should be able to adjust the goal when creating or modifying a program
- The tool should update the same `weekly_effort_goal` column

### API changes
- `GET /api/v1/workouts/weekly-effort` already returns a `goal` field — make it read from the user's stored goal instead of returning hardcoded 300
- `PUT /api/v1/profile` should accept `weekly_effort_goal` in the body

## Dependencies
- Requires migration 014 (effort_score column on workouts) — already done
- Requires the weekly effort endpoint — already done
