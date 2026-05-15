# Health Connect Import (Android)

Android counterpart to the existing Apple Health import flow: read past workouts from Health Connect (Google's on-device health hub) and import them through the same unified preview screen. This is the path through which workouts from Fitbit, Garmin Connect, Samsung Health, Strava, Whoop, Wear OS, Pixel Watch, etc. land in the app — those apps each write into Health Connect, and we read.

## Why Health Connect, not Google Fit

Google Fit APIs are end-of-life (no new sign-ups since May 2024, full shutdown end of 2026). Health Connect is the official replacement: on-device, unified schema, all major fitness vendors write to it. From Android 14 it's built into the OS; on 9–13 it's a Play Store app.

## Key files

### Backend
- `db/migrations/029_health_connect_source.sql` — extends the `workouts.source` CHECK constraint to allow `health_connect` (alongside `apple_health`, `gpx`, `tcx`, `fit`, `csv`, `gps`, `garmin`, `manual`).

### Frontend — native config
- `frontend/package.json` — adds `react-native-health-connect` (v3.5.0) + `expo-build-properties` (~0.14.0).
- `frontend/app.json` — registers `react-native-health-connect` as a config plugin (it ships its own `app.plugin.js` that wires the `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` intent filter); adds `expo-build-properties` for `compileSdkVersion`/`targetSdkVersion` 34 + `minSdkVersion` 26 (Health Connect's floor); adds the five Android health permissions (`READ_EXERCISE`, `READ_HEART_RATE`, `READ_DISTANCE`, `READ_TOTAL_CALORIES_BURNED`, `READ_EXERCISE_ROUTE`).

### Frontend — services
- `frontend/src/services/healthConnectService.ts` — Android analogue of `healthKitService.ts`. Lazy-loads the native module (so iOS / web don't crash on import), wraps `getSdkStatus` / `requestPermission` / `readRecords` / `requestExerciseRoute`. Provides:
  - `checkAvailability()` → `'available' | 'needs_install' | 'needs_update' | 'needs_dev_build' | 'not_supported'`.
  - `requestPermissions()` for `ExerciseSession` + `HeartRate` + `Distance` + `TotalCaloriesBurned` + `ExerciseRoute`.
  - `getRecentWorkouts(since)` — reads `ExerciseSession` records, summarizes them, enriches each session with `Distance` + `TotalCaloriesBurned` aggregates over its time window.
  - `getWorkoutHeartRate(start, end)` — flattens `HeartRate` records into `HRReading[]`.
  - `getWorkoutRoute(recordId)` — uses `requestExerciseRoute` (Health Connect's per-record route permission gate).
  - `buildHealthConnectParseResult(summary, hr, points)` — produces a `WorkoutFileParseResult` with `sourceFormat: 'health_connect'`.
  - `EXERCISE_TYPE_TO_ACTIVITY` map — Health Connect's numeric `ExerciseType` enum → canonical activity types (e.g. `56 (RUNNING) → run`, `74 (SWIMMING_POOL) → swim`, `70 (STRENGTH_TRAINING) → strength_training`).

- `frontend/src/services/externalImportService.ts` — thin platform-aware façade so import screens don't branch on platform. Exposes `getCurrentSource()` (`apple_health` on iOS, `health_connect` on Android), `getRecentWorkouts`, `loadWorkoutParseResult`, `markWorkoutImported`, plus a unified `ExternalWorkoutSummary` shape.

- `frontend/src/services/importedWorkoutsStore.ts` — generalized from `imported_healthkit_workouts` to source-agnostic `imported_external_workouts (source, external_id, backend_workout_id, imported_at)`. Includes a one-time SQLite migration that copies legacy iOS rows into the new table, then drops the old one. New API: `isImported(source, externalId)`, `markImported(source, externalId, workoutId)`, `getImportedKeys(source)`.

- `frontend/src/services/workoutFileParser.ts` — added `'health_connect'` to the `SourceFormat` union.

### Frontend — screens
- `frontend/src/screens/SettingsScreen.tsx` — "Connected Devices" row is now platform-aware: shows Apple Health on iOS (heart icon, red) and Health Connect on Android (fitness icon, green). Status label handles four states (`needs_install`, `needs_update`, `needs_dev_build`, `not_supported`). Toggle persists per-platform `SecureStore` flag (`apple_health_enabled` / `health_connect_enabled`).
- `frontend/src/screens/ImportScreen.tsx` — drops the iOS-only `Platform.OS !== 'ios'` guard. Uses `externalImportService` so the same screen lists Apple Health workouts on iOS and Health Connect workouts on Android, both via the unified `ExternalWorkoutSummary` shape.
- `frontend/src/screens/ImportPreviewScreen.tsx` — replaces `healthKitUuid` route param with `externalId` + `externalSource`. Loading copy is now source-aware. Calls `markWorkoutImported(externalId, savedId)` post-save.
- `frontend/src/screens/HistoryScreen.tsx`, `frontend/src/screens/WorkoutDetailScreen.tsx` — added `health_connect` source badge (fitness icon, Google green `#34A853`).

## Notable design decisions

- **`ExternalImportStatus` has four "not available" states** (`needs_install`, `needs_update`, `needs_dev_build`, `not_supported`) rather than the simpler iOS-side three. Health Connect can be missing entirely (older Android, never installed) or just out-of-date — the Settings copy distinguishes so users know whether to update or install.
- **Route fetch is per-record on Android.** Health Connect requires `requestExerciseRoute(recordId)` for each route the user wants to grant access to — there's no blanket route-read permission like there is on iOS. We call this lazily from the preview screen.
- **Distance and calories are aggregated, not pulled from the session record.** Unlike HKWorkout's `totalDistance`/`totalEnergyBurned` fields, `ExerciseSessionRecord` doesn't carry totals — we sum `Distance` + `TotalCaloriesBurned` records over the session's `[startTime, endTime]` window.
- **Dedupe table generalized in-place** rather than parallel `imported_apple_health` + `imported_health_connect` tables. CLAUDE.md mandates no backwards-compat hacks; the SQLite migration runs once per device and existing iOS users keep their import history.

## Known limitations

- **Intra-workout heart-rate samples from Fitbit are often incomplete.** Fitbit only writes a subset of HR detail to Health Connect — typically a per-minute summary, not the full per-second series. Workouts come through but the HR chart will be coarser than what Apple Health users see. A Fitbit Web API OAuth fallback exists in concept but isn't built (Fitbit's legacy Web API is also deprecating Sept 2026 as it migrates onto the new Google Health API — moving target).
- **Health Connect app must be installed on Android 9–13.** On Android 14+ it's part of the OS. We surface this via the `needs_install` status; tapping the row links the user to settings, but the install flow itself is OS-driven.
- **Google Play Health Apps Declaration is required before shipping.** This is paperwork in the Play Console (privacy policy URL match across in-app/listing/website, "not a medical device" disclaimer if applicable, Organization Account verification as of Jan 2026). Not a code change.
