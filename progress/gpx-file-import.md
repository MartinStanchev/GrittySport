# GPX File Import

## Summary
Added GPX file import capability, allowing users to import workouts from GPS devices (Garmin, Coros, Wahoo, etc.) directly via .gpx files.

## New Dependencies
- `expo-document-picker` — native file picker
- `fast-xml-parser` — XML → JSON parsing

## New Files
- **`frontend/src/services/gpxParser.ts`** — GPX parsing service
  - `pickGPXFile()` — file picker for .gpx files
  - `parseGPXFile()` — XML parsing with multi-track/segment support, HR extraction from multiple namespace styles
  - `detectActivityType()` — maps GPX type strings to app types with speed-based fallback
  - `buildGPXSavePayload()` — constructs save payload using existing `buildFinalGPSPayload()`
- **`frontend/src/screens/GPXPreviewScreen.tsx`** — Preview screen before saving (route map, activity type selector, stats, notes)
- **`frontend/src/__tests__/gpxParser.test.ts`** — 26 unit tests covering parsing, HR extraction, type detection, payload building

## Modified Files
- **`frontend/src/services/api.ts`** — Added `'gpx'` to `SaveWorkoutInput.source` union
- **`frontend/src/constants/activityIcons.ts`** — Exported `GPS_ACTIVITY_TYPES`
- **`frontend/src/components/FABActionSheet.tsx`** — Added "Import GPX File" row with `onImportGPX` prop
- **`frontend/src/screens/HomeScreen.tsx`** — Passes `onImportGPX` handler to FABActionSheet
- **`frontend/src/screens/HistoryScreen.tsx`** — Added GPX import header button, `gpx` source badge, `gpx` in keyStat
- **`frontend/src/screens/ActivityDetailScreen.tsx`** — "Import GPX" button for unlogged GPS activities
- **`frontend/src/navigation/HomeStackNavigator.tsx`** — Registered GPXPreview screen
- **`frontend/src/navigation/HistoryStackNavigator.tsx`** — Registered GPXPreview screen
- **`frontend/src/navigation/ProgramsStackNavigator.tsx`** — Registered GPXPreview screen

## Entry Points
1. FAB → "Import GPX File" (Home screen)
2. History header → map icon button
3. ActivityDetail → "Import GPX" button (GPS activities without linked workout only)

## No Backend Changes
Backend `source` field is VARCHAR(20) with no enum validation; `GPSRouteData` JSONB is already compatible.
