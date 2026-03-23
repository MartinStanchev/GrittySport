# GPS Controls Dock & Banner Fix

## Changes

### Always-visible controls dock
- Moved start/pause/resume/finish/discard controls out of the fading `ScrollView` into a new `controlsDock` inside the `panelGestureZone`, so they are always visible in both collapsed and expanded sheet states.
- Increased `collapsedPanelPeek` from 132 to 216 to accommodate the controls below the hero metrics.
- Removed the "Lock in your route, then tap start when you roll out." hint text and its style.
- Removed dead styles: `heroMetricsWrap`, `collapsedHandleWrap`, `collapsedHandle`, `panelChevron`.

### Banner hidden on recording screens
- Added `useNavigationState` with a recursive `getActiveRouteName` helper to `ActiveWorkoutBanner`.
- Banner now returns `null` when the current route is `RecordGPS` or `RecordManual`, preventing the top HUD elements from being pushed down by the redundant banner.

## Key Files
- `frontend/src/screens/RecordGPSScreen.tsx`
- `frontend/src/components/ActiveWorkoutBanner.tsx`

## Validation
- Frontend tests: 164 passed
- Frontend lint: 0 errors (pre-existing warnings only)
- Backend lint: passed
- Code simplifier: cleaned up 4 dead styles, no other issues
