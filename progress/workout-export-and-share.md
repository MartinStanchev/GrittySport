# Workout Export and Share (Phase 1)

Phase 1 of the workout-sharing feature: export a completed workout as a **GPX** or **TCX** file and hand it to the OS share sheet so the user can send it to Strava, Garmin Connect, Apple Mail, AirDrop, or any other installed app that accepts those file types.

Phase 2 (direct Strava OAuth upload) and the photo-overlay feature are deferred — not in this change.

## Behaviour

- A new **Share Workout** button appears on `WorkoutDetailScreen` whenever the workout has either GPS points or HR readings. Workouts with neither (pure strength/mobility) don't show it.
- Tapping it opens a bottom sheet with format options:
  - **GPX** — offered only when GPS points exist. Route + HR via `TrackPointExtension`.
  - **TCX** — always offered when the workout is shareable. Includes laps, HR, cadence. Best for Strava and Garmin Connect.
- The selected format is built as an XML string, written to a temp file in `Paths.cache`, and shared via `expo-sharing`'s `shareAsync` with the right MIME/UTI.
- File naming: `Gritty_<activity_type>_<YYYY-MM-DD>_<HHMM>.<ext>`.

## Format details

- **GPX 1.1** with the Garmin `gpxtpx:TrackPointExtension` namespace for HR + cadence. Round-trips cleanly through our own `parseGPXFile`.
- **TCX**:
  - Sport mapping: `run*` → `Running`, `cycl*`/`bike` → `Biking`, everything else → `Other`.
  - One `<Lap>` per recorded GPS lap (`gps_route.laps`) if present, otherwise a single lap covering the whole activity.
  - Per-Trackpoint cumulative `DistanceMeters` built from `point.distance_from_prev`.
  - HR + cadence merged into trackpoints by nearest-timestamp lookup (5s tolerance via binary search).
  - HR-only workouts (no GPS) emit Trackpoints with `<Time>` + `<HeartRateBpm>` but no `<Position>` — Strava accepts this for indoor activities.

## Files

### Added
- `frontend/src/services/workoutExport.ts` — `buildGPX`, `buildTCX`, `shareWorkoutExport`, `canExportWorkout`, `workoutHasGPS`, `workoutHasHR`.
- `frontend/src/__tests__/workoutExport.test.ts` — 21 tests covering format validity, round-trips through our own parsers, edge cases (HR-only, missing altitude, multi-lap, sport mapping, XML escaping, empty inputs).
- `frontend/src/__mocks__/expo-sharing.ts` — jest mock.
- `frontend/src/__mocks__/expo-file-system.ts` — extended with new-style `File`/`Directory`/`Paths` mocks alongside the existing legacy mocks.

### Modified
- `frontend/src/screens/WorkoutDetailScreen.tsx` — added Share button + share-format sheet. Code-simplifier pass extracted a `useAnimatedSheet` hook so the existing "Link to Program" sheet and the new "Share" sheet share one animation implementation instead of duplicating four `Animated.Value`s and four callbacks.
- `frontend/jest.config.js` — registered the two new module mocks.
- `frontend/package.json` — added `expo-sharing@~14.0.8` and `expo-file-system@~19.0.22`.

## Validation

- `npm test` — all 228 tests pass (11 suites including the new 21-test `workoutExport` suite).
- `npm run lint` — clean.
- Code-simplifier agent run per project rules; changes applied.

## Notes / non-goals

- **FIT export was intentionally skipped.** FIT is a binary format requiring the Garmin SDK; Strava and every consumer we care about for Phase 1 accept TCX/GPX. Adding FIT later if needed.
- **No backend changes.** XML generation is client-side from the workout payload we already fetch.
- **Phase 2 (Strava OAuth direct upload)** is the next step if/when we want one-tap "Share to Strava" instead of "share sheet → pick Strava app."
