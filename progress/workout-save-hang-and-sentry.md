# Workout save hang fix + Sentry monitoring

## Problem
A recorded GPS workout would hang on "Saving…" forever after tapping Save, with no
error shown and nothing in the backend logs.

## Root cause
Two compounding frontend bugs (the backend `Create` handler returns promptly —
achievement evaluation is already async in a goroutine):

1. **Unhandled rejection in the GPS save flow.** `WorkoutSummaryScreen.handleSave`
   awaited `saveWorkoutWithFallback` with **no try/catch/finally**, so any rejection
   left `saving = true` permanently with no user feedback. The other three save
   screens (`LogActivityScreen`, `RecordManualScreen`, `ImportPreviewScreen`) all
   already wrapped the call — only the GPS summary screen didn't.
2. **Missing SQLite column on upgraded installs.** `pending_workouts` is created with
   `CREATE TABLE IF NOT EXISTS`, which never alters an existing table. The
   `scheduled_activity_id` column was added on 2026-02-22 (commit `603d3e4`), so any
   device whose DB predated that build was missing the column and the offline-queue
   `INSERT` threw `no such column`. With internet flaky, the server save failed →
   offline fallback crashed on the missing column → unhandled rejection → infinite
   spinner.

## Fix (Change 1)
- `frontend/src/screens/WorkoutSummaryScreen.tsx` — wrapped `handleSave` in
  try/catch/finally; `setSaving(false)` in `finally`, error Alert ("Your workout is
  still here — please try again") in `catch`.
- `frontend/src/services/offlineStorage.native.ts` — added `migratePendingWorkouts()`
  run inside `getDB()`: `PRAGMA table_info` then `ALTER TABLE … ADD COLUMN
  scheduled_activity_id TEXT` when absent. (Takes effect on next DB open after the
  build ships.)
- `frontend/src/services/syncService.ts` — report failures via `captureError`: only
  for non-network server errors on save (`isNetworkError` guard), and always when the
  last-resort pending-queue write throws (then rethrow so the caller surfaces it).

## Sentry monitoring (Change 2)
Added `@sentry/react-native` (~7.2.0) for production crash/error visibility — this
class of handled-but-silent failure now reports.
- `frontend/src/services/monitoring.ts` (new) — env-gated wrappers
  (`initMonitoring`, `captureError`, `setMonitoringUser`, `navigationIntegration`).
  **No-op unless `EXPO_PUBLIC_SENTRY_DSN` is set**; `enabled: !__DEV__` so local runs
  don't report. `tracesSampleRate: 0.2`.
- `frontend/App.tsx` — `initMonitoring()` at module load; React Navigation integration
  registered in `NavigationContainer onReady`; `setMonitoringUser(user)` effect in
  `RootNavigator`; `export default Sentry.wrap(App)`.
- `frontend/app.json` — `@sentry/react-native` config plugin (resolves to the Expo
  plugin via `app.plugin.js`).
- `frontend/metro.config.js` (new) — `getSentryExpoConfig` for source-map collection.
- `frontend/.env` — documented `EXPO_PUBLIC_SENTRY_DSN` (blank = disabled).
- Tests: `frontend/src/__mocks__/sentry-react-native.ts` + `jest.config.js` mapper
  (native module unavailable under the node test env).

## Follow-ups / ops notes
- Create the Sentry project, set `EXPO_PUBLIC_SENTRY_DSN`, and add `SENTRY_AUTH_TOKEN`
  as an EAS secret for source-map upload at build time.
- Requires a new native build (added a native module).

## Verification
- `npx tsc --noEmit` — clean for all changed files (pre-existing unrelated errors only).
- `npx jest` — 256/256 pass (incl. `offlineFallback.test.ts`).
- `eslint` — clean (one pre-existing unused-`Text` warning in `App.tsx`).
- code-simplifier run: deduplicated the user-object mapping into `setMonitoringUser`.
