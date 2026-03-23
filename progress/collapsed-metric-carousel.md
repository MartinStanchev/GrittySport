# Collapsed Metric Carousel

Added a swipeable metric carousel to the live GPS workout screen's collapsed bottom pill so users can see more than just time/distance/pace without expanding the full sheet.

## Changes

### Metric Page Configuration
- Added **`frontend/src/utils/liveWorkout.ts`**: `CollapsedMetricId` type, `CollapsedMetricSlot`/`CollapsedMetricPage` interfaces, and `getCollapsedMetricPages()` function
- Pages are sport-aware: runners get pace variants + cadence; cyclists/swimmers get speed variants
- Page layout (time always fixed, two companion metrics per page):
  - **Page 1:** Distance + Pace (or Speed)
  - **Page 2:** Avg Pace (or Avg Speed) + Heart Rate
  - **Page 3:** Cadence + Elevation (run/walk) or Elevation + Lap (other sports)

### Carousel UI in RecordGPSScreen
- **`frontend/src/screens/RecordGPSScreen.tsx`**: Time metric stays fixed on the left; right portion is a horizontal `ScrollView` with `pagingEnabled` showing swipeable metric pairs
- Dot indicators below the metrics show the active page
- `resolveMetricValue`, `getMetricUnit`, `getMetricAccent` helper functions centralize metric formatting — used by both the collapsed carousel and the expanded secondary metrics grid (no duplication)
- `COLLAPSED_PANEL_PEEK` hoisted to module-level constant (was inline)

### Tests
- **`frontend/src/__tests__/liveWorkout.test.ts`**: 4 new tests covering `getCollapsedMetricPages` for runners, cyclists, cadence/no-cadence variants

## Key Files
- `frontend/src/utils/liveWorkout.ts`
- `frontend/src/screens/RecordGPSScreen.tsx`
- `frontend/src/__tests__/liveWorkout.test.ts`

## Verification
- Frontend tests: 168 passed (9 in liveWorkout suite)
- Frontend lint: passes clean
- Backend lint: passes clean
