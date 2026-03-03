# Task 10 (Partial): Apple Health Import

## Summary

Implemented Apple Health workout import, allowing iOS users to connect Apple Health in Settings, browse recent HealthKit workouts, and import them as first-class workouts in the app. Garmin integration is deferred to a separate task.

## What Was Implemented

- **HealthKit integration** via `@kingstinct/react-native-healthkit` v13.2.3 with Expo config plugin
- **Settings: Connected Devices** section with Apple Health enable/disable toggle (Android shows "Not available")
- **Import Screen** accessible from History header, showing Apple Health workouts from the last 14 days
- **Import detail sheet** with workout summary, optional linking to scheduled program activities
- **Activity type mapping** from 75+ HealthKit `WorkoutActivityType` enum values to our app's types (run, cycling, swim, strength, mobility, etc.)
- **Data normalization** of HR readings, GPS routes, distance, calories into our existing `SaveWorkoutInput` format
- **Duplicate prevention** using local SQLite tracking of imported HealthKit workout UUIDs
- **Source badges** on History list and Workout Detail screens (Apple Health heart icon, Garmin watch icon for future use)
- **GPS route rendering** for imported Apple Health workouts with outdoor route data

## Key Decisions / Deviations from task-10.md

- Used `@kingstinct/react-native-healthkit` instead of `react-native-health` (more modern, actively maintained, Nitro Modules, 31K weekly downloads)
- Garmin integration deferred entirely (requires Garmin Developer Program approval + OAuth 2.0 PKCE, not OAuth 1.0a as originally described)
- No backend changes needed: existing `workouts` table already has `source CHECK` constraint including `'apple_health'`, and `SaveWorkoutInput` supports all required fields
- Used SecureStore instead of AsyncStorage for the Apple Health enabled flag (already available, no extra dependency)
- WorkoutActivityType is a numeric enum at runtime; built a reverse mapping table for resolving names

## Files Created

- `frontend/src/services/healthKitService.ts` - HealthKit wrapper with permissions, querying, type mapping, data normalization
- `frontend/src/services/importedWorkoutsStore.ts` - SQLite tracking of imported workout UUIDs
- `frontend/src/screens/ImportScreen.tsx` - Import screen with workout list and detail sheet
- `frontend/src/__tests__/healthKitMapping.test.ts` - 26 unit tests for type mapping and data normalization

## Files Modified

- `frontend/package.json` - added `@kingstinct/react-native-healthkit`, `react-native-nitro-modules`
- `frontend/app.json` - added HealthKit config plugin with `NSHealthShareUsageDescription`
- `frontend/src/screens/SettingsScreen.tsx` - Connected Devices section
- `frontend/src/screens/HistoryScreen.tsx` - import button in header, source badge on workout rows
- `frontend/src/screens/WorkoutDetailScreen.tsx` - source badge in header, apple_health GPS route rendering
- `frontend/src/navigation/HistoryStackNavigator.tsx` - Import screen registration
- `frontend/src/navigation/HomeStackNavigator.tsx` - Import screen registration
