# Expandable Route Map

## Summary
Completed GPS activities now have an interactive, full-screen route map. The route preview on the workout summary/detail screens is tappable and opens a full-screen Modal where the user can pinch-zoom, pan, and rotate the route.

## Motivation
On the GPS workout summary screen the route map was static (`scrollEnabled={false}`, `zoomEnabled={false}`), so users couldn't inspect their route closely. Requested: tap-to-expand + zoom on completed GPS activities.

## Implementation
- **`frontend/src/components/RouteMapPreview.tsx`** — rewritten:
  - Extracted `toCoords` + `regionForCoords` helpers.
  - Preview map is now wrapped in a `Pressable` with an `expand-outline` hint badge; tapping opens a full-screen `Modal`.
  - Full-screen map has `scrollEnabled` / `zoomEnabled` / `rotateEnabled` / `pitchEnabled` / `showsCompass`, fits to the route bounds via `fitToCoordinates` on `onMapReady`, shows start (success) / end (error) markers, a close button (top-left) and a recenter button (bottom-right) both respecting safe-area insets.
  - Inner map switched to `height: '100%'` filling a default-180 container so caller height overrides leave no gap.
- **`frontend/src/screens/WorkoutSummaryScreen.tsx`** — replaced the duplicated inline `MapView`/`Polyline`/`UrlTile` block (and the now-dead `mapRegion`/`polylineCoords`) with `<RouteMapPreview gpsRoute={{ points: workout.points }} style={styles.map} />`. Kept the full-bleed banner look via `borderRadius: 0` override on `styles.map`.

Because `WorkoutDetailScreen` already uses `RouteMapPreview`, completed activities opened from History get the expandable map for free. The shared component also covers `ActivityDetailScreen` and `ImportPreviewScreen`.

## Validation
- `tsc --noEmit`: no errors in changed files (pre-existing errors elsewhere untouched).
- `eslint` on both files: clean.
- code-simplifier: merged duplicate `closeBtn`/`recenterBtn` styles into a shared `iconBtn`; otherwise clean.

## Notes
- Native-only interactive map (`react-native-maps`); web/fallback `NativeMap` stubs render the existing placeholder.
