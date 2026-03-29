# Enhanced Deterministic Workout Analytics

Adds richer code-driven (non-AI) workout analytics: cardiac efficiency tracking, sport-specific distance PRs, strength PRs, swim PRs, and structured week-over-week trend comparisons.

## What Changed

### Backend — New Analytics
- **Cardiac Efficiency** (`analytics.go`): Compares current avg HR at a given pace against historical workouts of the same activity family within a ±30 sec/km pace window. Requires ≥2 historical matches. Trend: improving (delta < -3), declining (delta > 3), or stable.
- **Weekly Trend** (`analytics.go`): ISO-week bucketing (using user timezone) over the last 5 weeks. Sub-trends:
  - Volume: this week vs last week (km + sessions + change %)
  - Effort: this week avg effort score vs last 4 weeks avg
  - HR at Pace: avg HR at similar pace this week vs last 4 weeks
- **Trend constants**: `TrendImproving`, `TrendStable`, `TrendDeclining` replace raw strings.

### Backend — Sport-Specific PRs (`records.go`)
- **Distance PRs**: Two-pointer sliding window (`computeBestSegmentTime`) finds fastest contiguous GPS segment. Targets: Running (5K, 10K, Half Marathon), Cycling (20K, 50K).
- **Swim PRs**: Proportional time estimation for 200m, 400m, 1500m from total distance/duration.
- **Strength PRs**: Per-exercise estimated 1RM (Epley: weight × (1 + reps/30)), heaviest set, session total volume. Deterministic ordering via sorted exercise names.
- **Enhanced base PRs**: All PRs now include `formatted_value`, `unit`, `previous_best`, `improvement_pct`.
- Historical queries use `activityTypeFamily()` to compare across related types (e.g., easy_run history counts for interval PRs).

### Backend — Helpers (`deviation.go`)
- `activityTypeFamily()` / `activityTypesInFamily()`: Group related activity types into families.
- `formatDurationSec()`: Formats seconds as "m:ss" or "h:mm:ss".
- `parseGPSPoints()` / `computeKmSplitsFromPoints()`: Parse GPS JSON once, reuse pre-parsed `[]GPSPoint` to avoid redundant JSON unmarshaling.

### Frontend — New Components
- **`CardiacEfficiencyCard`**: Heart icon colored by trend, delta HR circle with directional arrow, summary text, sample size indicator.
- **`WeeklyTrendCard`**: Rows for volume, effort, and HR-at-pace trends with color-coded change badges. Each sub-row only renders when its data exists.

### Frontend — Types & Integration
- `gps.ts`: Added `CardiacEfficiency`, `VolumeTrend`, `EffortTrend`, `HRTrend`, `WeeklyTrend` interfaces. Cleaned up `PersonalRecord` (removed duplicate camelCase fields).
- `WorkoutDetailScreen.tsx`: Cardiac efficiency card after effort score, styled PR section with formatted values and improvement %, weekly trend card replacing simple trend text (with fallback).
- `gpsUtils.ts`: Added `tempo_run` to `RUN_TYPES`.

## Code Quality Fixes (Simplifier)
- GPS JSON parsed once per historical workout, reused via `[]GPSPoint` field — eliminates up to 4× redundant JSON unmarshaling per workout
- Removed unused `duration_sec` and `heart_rate_data` columns from weekly trend query
- Removed unused `_ []KmSplit` parameter from `detectDistancePRs`
- Sorted map iteration in `detectStrengthPRs` for deterministic PR ordering
- Replaced 6+ raw trend strings with typed constants

## Key Files Changed
- `backend/internal/review/analytics.go` — cardiac efficiency, weekly trend, trend constants
- `backend/internal/review/records.go` — all PR detection (distance, swim, strength)
- `backend/internal/review/deviation.go` — activity type helpers, GPS parsing, duration formatting
- `backend/internal/review/deviation_test.go` — 22 tests covering all new pure functions
- `backend/internal/review/records_test.go` — 14 tests for PR detection
- `frontend/src/types/gps.ts` — new TypeScript interfaces
- `frontend/src/components/CardiacEfficiencyCard.tsx` — new component
- `frontend/src/components/WeeklyTrendCard.tsx` — new component
- `frontend/src/screens/WorkoutDetailScreen.tsx` — integration
- `frontend/src/services/gpsUtils.ts` — tempo_run addition

## Tests
- 22 Go tests pass (review package)
- 168 frontend tests pass
- golangci-lint clean
