# Marketing run-summary: premium metrics

Added the app's premium post-workout analytics to the **run-summary marketing scene** so the
studio video sells the differentiated features, not just basic stats. Mirrors exactly what the
real `WorkoutDetailScreen` renders.

## What was added to the scene
- **Personal Records ("best efforts")** — e.g. `Fastest 5K → 25:05 (+3.2%)`, `Fastest 1K → 4:57 (+1.4%)`,
  rendered with the real `PRBadge` + category + `formatted_value` + `(+x.x%)` improvement.
- **Pace-trend one-liner** — "Your pace was 30% faster than your last 2 runs at the same heart rate…"
  (`trendText`, mirrors `analytics.trend.comparison_text`).
- **Week-over-week trends** — volume / sessions / avg-effort / HR-at-pace rows via the real
  `WeeklyTrendCard` (`weeklyTrend`).
- Dropped the now-redundant generic `showPR` badge from this scene.

All three render inside the existing **Analytics** `PremiumStatsCard`, matching the product.

## Key files changed
- `frontend/src/marketing/types.ts` — `WorkoutSummarySceneProps` gains `personalRecords`,
  `trendText`, `weeklyTrend` (reusing real `PersonalRecord` / `WeeklyTrend` types).
- `frontend/src/marketing/MarketingWorkoutSummary.tsx` — renders the three premium sections,
  reusing real components.
- `frontend/src/marketing/scenes/app-summary-run.ts` — populated the new premium data.
- `frontend/src/components/PersonalRecordsList.tsx` — **new** shared component (extracted by
  code-simplifier) — single source of truth for the PR block.
- `frontend/src/screens/WorkoutDetailScreen.tsx` — refactored to use `PersonalRecordsList`
  (removed duplicated inline PR markup/styles that had drifted from the marketing fork).

## Regenerating the video
The `.mp4` is a built artifact — the scene edit doesn't update it. Re-run the marketing-studio
render for `app-summary-run` (restart Expo web first — Metro can't watch `/mnt/c` in WSL).

On `marketing-playground` branch.
