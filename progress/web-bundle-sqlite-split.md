# Web Bundle Fix: expo-sqlite Platform Split for importedWorkoutsStore

## Background

`eas update` failed at the web export step: `importedWorkoutsStore.ts` did `await import('expo-sqlite')` behind a runtime `IS_NATIVE` guard, but Metro resolves dynamic imports statically at bundle time, so the web bundle pulled in expo-sqlite's web worker, which imports `wa-sqlite.wasm` — an asset Metro isn't configured to resolve (no `metro.config.js`, `wasm` not in `assetExts`).

## Fix

Applied the existing house pattern (same as `offlineStorage.native.ts` / `.web.ts`):

- `importedWorkoutsStore.native.ts` — the real implementation; now uses a static `import * as SQLite from 'expo-sqlite'` and drops the redundant `IS_NATIVE` runtime guard + `any`-typed db handle (proper `SQLite.SQLiteDatabase` typing).
- `importedWorkoutsStore.web.ts` — stubs (`isImported` → false, `markImported` → no-op, `getImportedKeys` → empty set). Health imports don't exist in the browser, so nothing is lost.
- Deleted the unsplit `importedWorkoutsStore.ts`.

Callers (`ImportScreen.tsx`, `externalImportService.ts`) are untouched — Metro platform resolution picks the right variant.

## Verification

- `npx expo export --platform web` succeeds (the exact command that failed inside `eas update`).
- Full jest suite 268/268; eslint clean on both new files.

## Key files

- `frontend/src/services/importedWorkoutsStore.native.ts` (new, from old unsplit file)
- `frontend/src/services/importedWorkoutsStore.web.ts` (new)
- `frontend/src/services/importedWorkoutsStore.ts` (deleted)
