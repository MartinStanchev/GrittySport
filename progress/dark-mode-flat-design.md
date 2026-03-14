# Dark Mode & Flat Design Overhaul

## Summary
Removed card/box design patterns across the entire app and implemented dark mode with a settings toggle.

## Key Changes

### Theme Infrastructure
- **`frontend/src/constants/colors.ts`** — Added `ThemeColors` interface, `LightColors`, `DarkColors` objects with full palette (primary, background, surface, surfaceAlt, border, overlay, success/warning/error/info, etc.)
- **`frontend/src/contexts/ThemeContext.tsx`** — New context providing `colors`, `isDark`, `toggleTheme`. Uses `expo-secure-store` for persistence. Value is `useMemo`-wrapped to prevent unnecessary re-renders.
- **`frontend/App.tsx`** — Wrapped app with `<ThemeProvider>`, StatusBar responds to `isDark`

### Navigation
- `BottomTabNavigator.tsx`, `HomeStackNavigator.tsx`, `HistoryStackNavigator.tsx`, `ProgramsStackNavigator.tsx` — Header and tab bar colors from theme

### All Screens Updated (16 files)
- HomeScreen, SettingsScreen (dark mode toggle), HistoryScreen, ImportScreen, ProgramsScreen, ProgramDetailScreen, ActivityDetailScreen, WorkoutSummaryScreen, WorkoutDetailScreen, LogActivityScreen, RecordManualScreen, RecordGPSScreen, CreateProgramBasicsScreen, CreateProgramScheduleScreen, CreateProgramReviewScreen, WorkoutFilePreviewScreen
- LoginScreen, RegisterScreen, authStyles.ts

### All Components Updated (~20 files)
- WorkoutCharts, EffortScoreCard, SplitsCard, PremiumStatsCard, RouteMapPreview, ProgramAlignmentCard, StepIndicator, HRSensorModal, CriteriaEditorModal, LiveHRChart, UpcomingActivityCard, FABActionSheet, ProgramProposalCard, ProgramModificationCard, ActiveWorkoutBanner, PostWorkoutReviewBanner, ClearChatModal, PrescriptionDisplay, PrescriptionEditor

### Design Pattern
- Removed card shadows/elevation/borderRadius boxing
- Replaced with flat layouts using `borderBottomWidth: StyleSheet.hairlineWidth` for separation
- Colors applied inline via `[styles.foo, { color: colors.xxx }]` pattern
- Structural styles (padding, flex) remain in `StyleSheet.create`

### Code Simplifier Fixes
- ThemeContext: `useMemo` on provider value, functional updater for `toggleTheme`, cached `expo-secure-store` import
- Replaced hardcoded semantic colors (`#4CAF50`, `#F44336`, `#FF9800`) with `colors.success/error/warning` in SplitsCard, ProgramAlignmentCard, WorkoutSummaryScreen, HomeScreen
- Replaced hardcoded overlay colors with `colors.overlay` in ClearChatModal, FABActionSheet, ImportScreen, CreateProgramScheduleScreen
- Fixed lint errors: escaped apostrophes, removed unused import
