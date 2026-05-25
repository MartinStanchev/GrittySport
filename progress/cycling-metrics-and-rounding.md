# Cycling Metrics + 2-Decimal Rounding

## Summary
Pass over both workout summary screens to (1) round km/h and raw distance fields to 2 decimals, (2) make cadence read `rpm` for cycling, (3) persist power (avg/max W) end-to-end, (4) add Energy (kJ), Moving Time, VAM stats for cycling, and (5) extend the Apple Health importer to extract laps, cycling cadence and cycling power (iOS 17+).

## Rounding (2 decimals)
- `formatSpeedKph` (`gpsUtils.ts`): `.toFixed(1)` → `.toFixed(2)`. Affects WorkoutSummary, WorkoutDetail (GPSDetail), ImportPreview, and lap-split tables.
- `WorkoutDetailScreen.tsx` `RunDetail` / `CyclingDetail`: raw `${data.distance_km}` / `${data.avg_speed_kph}` now go through `Number(...).toFixed(2)` / `formatSpeedKph`.
- `ProgramAlignmentCard.tsx` prescribed/actual distance: `.toFixed(1)` → `.toFixed(2)`.

## Cadence unit
- Added `cadenceUnit(activityType)` to `gpsUtils.ts` — returns `'rpm'` for cycling, `'spm'` otherwise.
- Threaded `activityType` through `CadenceChart` (new optional prop).
- Updated `WorkoutSummaryScreen`, `WorkoutDetailScreen` (GPSDetail + HROnlyDetail), `ImportPreviewScreen` to render the right unit.

## Power (avg/max W) end-to-end
- `types/gps.ts`: added `avg_power`/`max_power` on `GPSRouteData` + `GPSSummaryData`, and `power_readings` on `HRData`.
- `buildFinalGPSPayload` now accepts `powerReadings`, computes avg/max, writes them into route + summary + sensor blob.
- `buildFileSavePayload` passes `powerReadings` through (previously dropped silently).
- `WorkoutDetailScreen` GPSDetail and `WorkoutSummaryScreen` render Avg Power / Max Power stat tiles when present.

## Energy (kJ) + Moving Time + VAM
- New helper `computeCyclingDerivedStats({ durationSec, autoPausedSec, elevationGainM, avgPower })` in `gpsUtils.ts` returns `{ movingSec, vamMetersPerHour, energyKJ }`.
- Both screens call it; Moving Time shown only when there was auto-paused time, VAM only when elevation gain > 0, Energy only when power is present.

## Apple Health import (iOS)
- `summarizeSample` now extracts `WorkoutEvent.lap` boundaries into a `lapEvents: { startMs, endMs }[]` on `HealthKitWorkoutSummary`.
- New `buildLapsFromEvents(events, workoutStart, workoutEnd, points, hr)` synthesizes `Lap[]` from those boundaries plus the GPS / HR streams. Handles both interval-style events (start/end differ) and boundary-marker events (split between successive markers). Uses an exclusive-lower-inclusive-upper window so a boundary point doesn't double-count its `distance_from_prev` segment.
- New `getWorkoutCyclingCadence` and `getWorkoutCyclingPower` query `HKQuantityTypeIdentifierCyclingCadence` and `HKQuantityTypeIdentifierCyclingPower` (iOS 17+; fall back to `[]` on older OS / errors).
- `requestPermissions` now asks for the two new types alongside the existing list — older iOS ignores unknown identifiers.
- `externalImportService.loadWorkoutParseResult` fetches cycling cadence + power in parallel with HR + route when the workout maps to `cycling`, and passes them into `buildHealthKitParseResult`.

## Not changed
- BLE live cycling cadence/power capture during in-app GPS recordings — still not wired.
- Health Connect (Android) parallel: same fields still empty arrays; mirror change is a follow-up.
- Cycling-flavored split row in `SplitsCard` (rejected — per-km splits stay pace-formatted).
- `Avg Pace` stat tile for cycling (rejected).

## Key files changed
- `frontend/src/types/gps.ts`
- `frontend/src/services/gpsUtils.ts`
- `frontend/src/services/healthKitService.ts`
- `frontend/src/services/externalImportService.ts`
- `frontend/src/services/workoutFileParser.ts`
- `frontend/src/components/WorkoutCharts.tsx`
- `frontend/src/components/ProgramAlignmentCard.tsx`
- `frontend/src/screens/WorkoutDetailScreen.tsx`
- `frontend/src/screens/WorkoutSummaryScreen.tsx`
- `frontend/src/screens/ImportPreviewScreen.tsx`
- `frontend/src/__tests__/healthKitMapping.test.ts` (lap-building + cadence/power passthrough cases)
- `frontend/src/__tests__/gpsUtils.test.ts` (updated `formatSpeedKph` expectations)
