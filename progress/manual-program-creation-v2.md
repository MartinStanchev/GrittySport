# Manual Program Creation v2

## Summary

Reworked manual program creation from a 3-step wizard into a 4-step Aura Kinetic flow that mirrors the Grit AI proposal flow at the bookends and reuses the rich activity editor in the middle. Adapted from a Claude Design v2 mock; rejected the design's flat activity editor and start-date toggle in favor of keeping the existing structured `PrescriptionEditor` and detailed start date picker.

## Flow

1. **Basics** — name, sport (chips with **General Fitness** and **Other** added; "Other" reveals a text input), goal mode toggle (`Race / Event` vs `Open Duration`), event chips + date with weeks-until countdown, free-text goal description (kept), start date picker (week arrows + Today / Next Monday / +1 day quick presets — kept and expanded).
2. **Phases** — preset chips (Base/Build/Peak, Foundation+Race Prep, Single Block, Custom), per-phase color bar + name input + week stepper + delete, add-phase, proportional arc bar, total-duration footer with computed end date.
3. **Week Template** — color-coded phase tabs, Mon-Sun day list with Add buttons, bottom-sheet activity editor that reuses the existing `PrescriptionEditor` for full structured prescriptions (run/cycling/swim/strength/mobility/generic), stats footer (sessions / est. time / rest days).
4. **Review** — reuses the existing `ProposalReviewView` (sport badge, stat circles, phase accordion, sticky bottom bar). Generalized that component with optional `byline` / `headerTitle` / `acceptLabel` / `denyLabel` props so manual mode can hide the "BY GRIT" badge, set a custom title, and rename the accept button to "CREATE PROGRAM". Deny button becomes optional.

## Why this design and not the v2 mock as-is

- v2 mock's `ActivityEditor` was flat (`detail`, `duration`, `sets`, `reps`, `intensity`, `notes`) — that would have killed structured strength `exercises` arrays and benchmark-driven prescriptions. Kept `PrescriptionEditor`.
- v2 mock's Step 4 was bespoke (phase accordion + arc + Today/Next-Mon toggle). Kept `ProposalReviewView` for visual consistency with the Grit AI flow per CLAUDE.md "no backwards compatibility, refactor completely". Date picker stays in Step 1 with full controls.
- v2 mock dropped the free-text `goal_description`. Kept it — backend `TemplateProgramInput.goal_description` is still load-bearing and Grit reviews use it.
- v2 mock had only 8 sport chips and no `general_fitness`. New `SPORT_OPTIONS` constant carries 10 chips and maps each to a backend skill key (`running`, `cycling`, `swimming`, `strength_training`, `powerlifting`, `triathlon`, `general_fitness`, `null` for Yoga/CrossFit/Other) so future early-skill loading can read it.

## Backend

No changes — payload (`TemplateProgramInput` → `POST /api/v1/programs`) is unchanged. Step 4 still calls `createProgram(...)` with `name`, `sport`, `goal_description`, `start_date`, `end_date`, and `phases[*]` (`name`, `order_index`, `duration_weeks`, `template_week.activities`).

## Key files

### New
- `frontend/src/constants/sports.ts` — `SPORT_OPTIONS` / `SPORT_LABELS`, `RACE_EVENTS`, `PHASE_PRESETS`, `PHASE_COLORS`
- `frontend/src/screens/CreateProgramPhasesScreen.tsx` — Step 2

### Rewritten
- `frontend/src/screens/CreateProgramBasicsScreen.tsx` — Step 1 (4-step indicator, goal mode, event chips, sport with Other handling)
- `frontend/src/screens/CreateProgramScheduleScreen.tsx` — Step 3 (phase management removed — now in Step 2; phase colors threaded through tabs / day rows / activity sheet; stats footer)
- `frontend/src/screens/CreateProgramReviewScreen.tsx` — Step 4 (thin wrapper around `ProposalReviewView`)

### Modified
- `frontend/src/components/ProposalReviewView.tsx` — added optional `byline`/`headerTitle`/`acceptLabel`/`denyLabel` props; `onDeny` now optional; existing Grit usage in `HomeScreen.tsx` uses defaults so no caller changes needed
- `frontend/src/navigation/ProgramsStackNavigator.tsx` — registered `CreateProgramPhases`; review screen uses `headerShown: false` since `ProposalReviewView` ships its own header

## Validation

- `npx tsc --noEmit` clean for all touched files (only pre-existing errors in unrelated `LiveHRChart` / `WorkoutCharts` / `useNotifications.ts`).
- `npx jest`: 181 / 181 tests pass.
- Code-simplifier agent applied: dropped redundant refs/effects (route params already live), dropped `useCallback` with no memoized consumers, dropped a `typeof === 'object'` guard already implied by the type, switched `TouchableOpacity` to `Pressable` for codebase consistency.
