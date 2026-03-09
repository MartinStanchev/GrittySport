# Multi-Format Workout File Import (TCX, FIT, CSV, ZIP)

## Summary
Extended the workout file import system from GPX-only to support TCX, FIT, CSV, and ZIP archives. All formats produce the same `WorkoutFileParseResult` type and feed into the existing `buildFinalGPSPayload()` pipeline.

## Key Changes

### New Files
- `frontend/src/services/workoutFileParser.ts` — Unified parser entry point with `pickWorkoutFile()`, `parseWorkoutFile()`, `detectActivityType()`, `buildFileSavePayload()`, `emptyParseResult()`
- `frontend/src/services/parsers/tcxParser.ts` — TCX XML parser (uses fast-xml-parser), extracts laps, HR, cadence
- `frontend/src/services/parsers/fitParser.ts` — FIT binary parser (uses fit-file-parser + buffer polyfill), handles semicircle coordinates, power data
- `frontend/src/services/parsers/csvParser.ts` — Manual CSV parser with delimiter auto-detection, flexible column mapping, HR-only support
- `frontend/src/services/parsers/zipHandler.ts` — ZIP extraction via jszip, parallel file parsing with error collection
- `frontend/src/screens/WorkoutFilePreviewScreen.tsx` — Generalized preview screen (replaces GPXPreviewScreen), supports ZIP multi-file list
- `db/migrations/013_extend_source_constraint.sql` — Extended source CHECK constraint for new formats

### Modified Files
- `frontend/src/services/gpxParser.ts` — Refactored to return `WorkoutFileParseResult`, removed moved functions
- `frontend/src/components/FABActionSheet.tsx` — `onImportGPX` → `onImportFile`, updated label/subtitle
- `frontend/src/screens/HomeScreen.tsx` — Uses `pickWorkoutFile()`, navigates to `WorkoutFilePreview`
- `frontend/src/screens/HistoryScreen.tsx` — Same import flow update, added source badges for new formats
- `frontend/src/screens/ActivityDetailScreen.tsx` — Same import flow update
- `frontend/src/navigation/HomeStackNavigator.tsx` — `GPXPreview` → `WorkoutFilePreview`
- `frontend/src/navigation/HistoryStackNavigator.tsx` — Same route update
- `frontend/src/navigation/ProgramsStackNavigator.tsx` — Same route update
- `frontend/src/services/api.ts` — Extended `SaveWorkoutInput.source` union with `'tcx' | 'fit' | 'csv'`
- `frontend/src/types/gps.ts` — Added `PowerReading` interface

### Deleted Files
- `frontend/src/screens/GPXPreviewScreen.tsx` — Replaced by WorkoutFilePreviewScreen

### Dependencies Added
- `fit-file-parser` — FIT binary parser
- `jszip` — ZIP extraction
- `buffer` — Node Buffer polyfill for React Native

## Tests
- `tcxParser.test.ts` — 31 tests (laps, trackpoints, HR, cadence, sport mapping, edge cases)
- `fitParser.test.ts` — 25 tests (coordinate conversion, sport enum, power, corrupt file handling)
- `csvParser.test.ts` — 38 tests (delimiter detection, column mapping, missing columns, quoted fields, HR-only)
- `workoutFileParser.test.ts` — 22 tests (format dispatch, payload builder, type detection)
- All 159 tests passing across 7 suites

## Code Simplifier Fixes Applied
- Removed redundant `isZip` prop from WorkoutPreview (derived from `onBackToList`)
- Replaced `Math.max(...spread)` with single-pass loop (stack safety for large arrays)
- Combined avg/max HR and power into single-pass computation
- Used `PowerReading` type from gps.ts in csvParser and fitParser
- Used shared `avgPaceSecPerKm`/`avgSpeedKph` from gpsUtils in tcxParser and fitParser
- Imported `getExtension` from workoutFileParser in zipHandler (no duplication)
- Used `Promise.allSettled` for parallel ZIP file parsing
