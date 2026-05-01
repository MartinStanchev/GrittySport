# Unified Import Preview Screen

## Summary

Apple Health and workout-file imports now share a single full-screen preview (`ImportPreviewScreen`) instead of using two divergent UIs. Previously, file imports got a rich screen (route map, stat tiles, HR chart, laps, type chips, notes, link-to-scheduled-activity) while Apple Health imports got a cramped 80%-height bottom sheet with a summary table only — and the linking UI was hard to discover.

## What Changed

- New `ImportPreviewScreen` accepts either route shape:
  - File flow: `{ fileUri, fileName, scheduledActivityId?, preselectedType? }`
  - Apple Health flow: `{ healthKitUuid, scheduledActivityId?, preselectedType? }`
- Apple Health branch fetches `getWorkoutByUUID` + HR samples + GPS route up-front, then builds a `WorkoutFileParseResult` via the new `buildHealthKitParseResult`. After save, calls `markImported(uuid, savedId)`.
- `ImportScreen` no longer renders the bottom sheet — tapping a workout row navigates to `ImportPreview`. `useFocusEffect` refreshes the imported-UUIDs list when returning.
- `WorkoutFileParseResult` gained optional `caloriesKcal` and `sourceDevice`; `buildFileSavePayload` folds them into `recorded_data` when present. `SourceFormat` widened with `'apple_health'`.
- Old per-screen helpers (`computeElevationGain`, `round2`) deleted from `healthKitService.ts` in favor of the shared one in `gpsUtils`.

## Tradeoff Accepted

HR samples + GPS route now load when the preview opens (not when the user taps "Import"), so opening a HealthKit workout takes a beat longer and pulls data even if the user cancels — bought in exchange for the unified screen and one save/linking pipeline.

## Files

**Created**
- `frontend/src/screens/ImportPreviewScreen.tsx` (renamed/expanded from `WorkoutFilePreviewScreen.tsx`)
- `progress/unified-import-preview.md`

**Modified**
- `frontend/src/services/healthKitService.ts` — replaced `buildSaveWorkoutInput` with `buildHealthKitParseResult`; added `getWorkoutByUUID`; factored `summarizeSample`
- `frontend/src/services/workoutFileParser.ts` — widened `SourceFormat`, added optional calories/device fields
- `frontend/src/screens/ImportScreen.tsx` — removed bottom sheet, navigate to preview, focus-effect refresh
- `frontend/src/__tests__/healthKitMapping.test.ts` — rewrote to test `buildHealthKitParseResult` + end-to-end with `buildFileSavePayload`
- Navigators: `HistoryStackNavigator`, `HomeStackNavigator`, `ProgramsStackNavigator` — registered `ImportPreview`
- Callers: `ActivityDetailScreen`, `HomeScreen`, `HistoryScreen` — `navigation.navigate('ImportPreview', ...)`

**Deleted**
- `frontend/src/screens/WorkoutFilePreviewScreen.tsx`
