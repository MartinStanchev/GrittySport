# HR Sensor for Non-GPS Workouts + Strength Set-Detection

Adds heart-rate sensor support to the manual workout flow (strength, mobility, drill, plus indoor_run / indoor_cycling / swim — all routed through `RecordManualScreen`) and an HR-spike-driven highlight that nudges the user toward the next unfilled set during strength workouts.

## What changed

### HR sensor for non-GPS workouts
- `WorkoutContext.ActiveWorkout` extended with `hrReadings`, `currentHR`, `avgHR`, `hrDeviceName`. `startWorkout` initializes them to empty / null; existing call sites unchanged.
- New inline `HRSensorPill` in the timer bar — disconnected state opens `HRSensorModal`; connected state shows live BPM in the HR-zone color and toggles a collapsible chart panel.
- Collapsible panel below the timer bar mounts `LiveHRChart` while recording. Reused as-is from the GPS flow.
- New inline `HRStatsRow` in the pre-save summary view: Avg HR, Max HR, and a single-row HR-zone distribution bar built from `computeHRZoneDistribution` + `HR_ZONE_COLORS`.
- `buildRecordedData` adds `avg_hr` / `max_hr` to the `recorded_data` summary when HR was captured.
- `handleSave` sends `heart_rate_data: { readings, device_name }` matching `HRData` shape — backend already persists this column, and `WorkoutDetailScreen` already renders `HROverTimeChart` from it. Zero backend or detail-screen changes.
- `handleDiscard` calls `bleService.disconnect()` before clearing the workout. Save mirrors GPS lifecycle (connection persists into summary). An unmount cleanup effect disconnects if the screen drops without a workout still active.

### Strength set-detection
- New `frontend/src/utils/setDetection.ts`:
  - Pure FSM `stepDetection(state, reading)` running phases `IDLE → RISING → PEAK → RECOVERING → fires SET_DETECTED → IDLE`.
  - Rolling baseline = mean of the last `MAX_BASELINE_SAMPLES` readings collected only while in IDLE — the baseline reflects rest, not exercise.
  - Tunable thresholds: `RISE_THRESHOLD_BPM=12`, `RISE_SUSTAIN_SEC=5`, `PEAK_HOLD_MIN_SEC=3`, `RECOVERY_DROP_BPM=5`, `RECOVERY_CONFIRM_SEC=4`, `MIN_TIME_BETWEEN_DETECTIONS_SEC=30`.
  - `LIGHT_WORK_FALLBACK_RISE_BPM=8` latches in after 5 minutes if no spike has crossed the normal threshold — covers light isolation work.
  - `findNextUnfilledSet(exercises)` walks exercises in display order returning the first `set.completed === false`.
  - `useSetDetection` hook keeps the FSM in a ref, only `setState`s on detection, auto-fades highlight after `HIGHLIGHT_TTL_MS=25000`, exposes `dismiss()`.
- `StrengthLogger` accepts `highlight` + `onDismissHighlight` props. The highlighted `SetRow` wraps in `Animated.View` with a looping border-color + background pulse (1.4s period, `colors.primary`). No `pointerEvents` change — taps still work. First interaction with the highlighted row clears the glow.
- Feature is dormant when no HR is connected, the workout type is not `'strength'`, or all sets are completed. Indoor_run / indoor_cycling / swim infer to `'drill'` and so get HR display but no set-detection (correct — they are continuous-effort).

## Files changed
- `frontend/src/contexts/WorkoutContext.tsx` — added HR fields to `ActiveWorkout`; `startWorkout` defaults them.
- `frontend/src/screens/RecordManualScreen.tsx` — HR pill, chart panel, modal mount, save payload, summary stats, set-detection wiring, animated `SetRow`.
- `frontend/src/utils/setDetection.ts` *(new)* — FSM, helpers, hook.
- `frontend/src/__tests__/setDetection.test.ts` *(new)* — 14 unit tests covering FSM phases, cooldown, light-work mode, false starts, plateau, bounce-back, and `findNextUnfilledSet` edge cases.

## Reused
`bleService`, `HRSensorModal`, `LiveHRChart`, `getHRZoneColor`, `HR_ZONE_COLORS`, `computeHRZoneDistribution`, `HRReading` / `HRData` types.

## Verification
- `npx jest src/__tests__/setDetection.test.ts` — 14/14 passing.
- `npx eslint` on modified files — 0 errors. Pre-existing warnings only.
- Manual scenarios listed in `/home/marts/.claude/plans/validated-munching-harp.md` (verification section).

## Notes
- All thresholds in `setDetection.ts` are exported constants for tuning after real-world testing.
- Backend required no changes — `heart_rate_data` JSONB column has existed since task-9-6; `WorkoutDetailScreen` reads it source-agnostically.
