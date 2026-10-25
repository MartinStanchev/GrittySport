# Indoor Cardio Recording (Indoor Run / Indoor Cycling)

Indoor runs and rides now record on a dedicated screen that matches the GPS recording UX, with a zone HR chart, laps and calories. After finishing, they get the same summary, save, link-to-scheduled-activity and Grit review flow as GPS workouts.

## Behavior

- **Start button.** `RecordIndoorScreen` opens in a "Ready" state. The workout is created only when the user taps **Start Workout**, the same as GPS. Before that, HR auto-connects and shows as a live preview.
- **Unified controls.** The screen uses the GPS screen's hold-to-activate **Lap / Pause / Finish** controls, and **Finish / Resume / Discard** while paused. It also shares the session badge, the hero metrics card (Time · HR · Calories), the metric cards (Avg HR, Zone, Lap with current lap time, Last Lap) and the HR sensor row.
- **Zone HR chart.** The color-banded `HROverTimeChart` from the summary screens is drawn live where the map would be. A placeholder with a "Connect sensor" button shows when there's no HR.
  - The old `LiveHRChart` is deleted. The strength/mobility/drill HR panel in `RecordManualScreen` also uses the zone chart now.
- **Calories.** The estimate shows live and in the summary, and is saved as `recorded_data.calories`.
  - With HR, it uses the Keytel (2005) equation with an average HR, age (from `birth_year`) and weight. The male and female coefficients are averaged because the profile has no sex field.
  - Without HR, it falls back to MET values. New ones: `indoor_run` 9, `indoor_cycling` 7.
- **Laps.**
  - Laps only count active time, so pauses are excluded.
  - Each lap shows its average HR. A press within 1 s of the last one is ignored.
  - A lap press shows a "Lap N · m:ss" toast.
  - On Finish, the stretch after the last press is closed into a final lap.
  - Lap splits appear in the summary only if Lap was pressed (≥ 2 laps). They're saved as `recorded_data.laps` with `{lap_number, start_time, end_time, duration_sec, avg_hr}`.
- **Summary and linking.** `IndoorWorkoutSummaryScreen` shows Time, Calories, Avg/Max HR, Laps, the HR zones bar, the HR chart, the lap table (left edge colored by HR zone), the effort preview and notes.
  - After saving, `PostWorkoutReview` offers linking to a scheduled activity plus Grit's review, the same as GPS.
- **Saved workout detail.** `WorkoutDetailScreen` shows calories and the lap table for indoor workouts. Calories prefer `recorded_data.calories`, otherwise an estimate that is now HR-aware.
- **Routing fix.** `isGPSActivity` matched `run` inside `indoor_run` and `cycling` inside `indoor_cycling`, so scheduled indoor sessions opened the GPS screen. `getRecordScreen(type)` now picks the screen, and every record entry point uses it (Home, Activity detail, Program detail, Quick-start "repeat last").

## Implementation

- `WorkoutContext`:
  - New `'cardio'` `WorkoutType` and a `laps: IndoorLap[]` field on `ActiveWorkout`.
  - `startWorkout` defaults the strength/mobility/drill logger fields.
  - New derived `activeRecordScreen`, used by `ActiveWorkoutBanner` and by `RecordManualScreen`'s resume redirect.
- `utils/indoorWorkout.ts`: `buildIndoorLap`, `closeFinalIndoorLap`, `buildIndoorRecordedData`.
- `services/gpsUtils.ts`:
  - `estimateCalories` now takes an object with `avgHR` and `profile`.
  - New `calorieProfile` and `summarizeHR`; `summarizeHR` is also used by `buildFinalGPSPayload` and `RecordManualScreen`.
  - `hasRecordedLaps` is now generic.
- `utils/units.ts`: `ageFromBirthYear`, also adopted in ProfileSetup and BodyMetrics.
- Shared extractions:
  - `components/LiveWorkoutControls.tsx`: `HeroMetric`, `SecondaryMetricCard`, `PrimaryActionButton`, `ControlButton`, `RecordingControls`, `HRSensorRow`, `SessionBadge`. Moved out of `RecordGPSScreen`.
  - `components/WorkoutSummaryParts.tsx`: `SummaryHeader`, `SummarySection`, `SummaryStatCard/Grid`, `HRZoneBar`, `HRZonesSection`, `SummaryNotes`, `SummaryActions`, `lapTableStyles`.
  - `hooks/useWorkoutSummarySave.tsx`: save/discard/Done/offline flow shared by the GPS and indoor summaries. An offline save now shows a toast instead of a banner that was never visible.
  - `hooks/useWorkoutHRLog.ts`: HR buffer with a running average, shared by the manual and indoor screens.
- `HROverTimeChart` is wrapped in `React.memo`, so the 1 s timer tick doesn't redraw it.
- The type picker in `RecordManualScreen` gives each option an explicit target screen. Pool "Swim" stays manual. `RecordManualScreen` also redirects any GPS or indoor type it receives to the right screen.
- No backend changes. Grit already reads `recorded_data` verbatim in reviews, so it sees calories and laps.

## Known gaps / follow-ups

- Activity classification still uses substring matching (`GPS_ROOTS`/`MANUAL_ROOTS`). Scheduled `swim` still opens GPS, which predates this change. An exact type → screen table would fix it, but it changes behavior for several types.
- HR readings are still copied into context on every reading (the same pattern as the GPS and manual screens).

## Key files

- New:
  - `frontend/src/screens/RecordIndoorScreen.tsx`
  - `frontend/src/screens/IndoorWorkoutSummaryScreen.tsx`
  - `frontend/src/components/LiveWorkoutControls.tsx`
  - `frontend/src/components/WorkoutSummaryParts.tsx`
  - `frontend/src/components/IndoorLapsTable.tsx`
  - `frontend/src/hooks/useWorkoutSummarySave.tsx`
  - `frontend/src/hooks/useWorkoutHRLog.ts`
  - `frontend/src/utils/indoorWorkout.ts`
  - `frontend/src/__tests__/indoorWorkout.test.ts`
- Changed:
  - `RecordGPSScreen.tsx`, `WorkoutSummaryScreen.tsx`, `RecordManualScreen.tsx`, `WorkoutDetailScreen.tsx`
  - `HomeScreen.tsx`, `ActivityDetailScreen.tsx`, `ProgramDetailScreen.tsx`
  - `ActiveWorkoutBanner.tsx`, `WorkoutContext.tsx`, `WorkoutCharts.tsx`
  - `gpsUtils.ts`, `activityIcons.ts`, `units.ts`
  - Home and Programs stack navigators
- Deleted: `frontend/src/components/LiveHRChart.tsx`
