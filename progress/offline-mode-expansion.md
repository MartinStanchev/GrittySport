# Offline Mode Expansion (read caches + offline recording everywhere)

Follow-on to [offline-mode](offline-mode.md). The original Task 15.1 work kept the
user signed in offline and cached the active-program *summary* + upcoming
activities, but the production build still looked broken offline: most data
screens fetched straight from the network with no fallback (blank History, blank
adherence, empty home stats), and only the GPS flow could record offline.

## Problem

- `getWorkouts` was never cached → History, LastWorkoutCard, QuickStartSection,
  and HomeScreen's weekly-completed / today-completed hooks all went blank
  offline (errors were silently swallowed by `useFetchOnFocus` / HistoryScreen).
- `getProgram` (full detail) was never cached → ProgramDetailScreen and
  HomeScreen's adherence bar went blank offline.
- Only `WorkoutSummaryScreen` (GPS) had a `savePendingWorkout` fallback. The
  manual/log/import save paths called `saveWorkout` directly and just failed
  offline.

## What changed

**Cached-read layer (`src/services/cachedReads.ts`, new)**
- `withCache(key, fetcher)` — fetch fresh + write cache on success; on a
  `isNetworkError` fall back to the last cached snapshot; non-network errors
  (auth/4xx/5xx) still throw.
- `getProgramCached(id)` → caches under `program_detail:<id>`.
- `getRecentWorkoutsCached()` → caches a broad 50-item snapshot under
  `recent_workouts`; doubles as History's offline source.
- `getCachedRecentWorkouts()` → cache-only read (no fetch) for offline fallback.

**Cache keys (`src/services/offlineStorageTypes.ts`)**
- Added `recentWorkouts` key and `programDetailKey(id)` helper.
- `CacheKey` widened from a fixed union to `string` so id-scoped keys work.
- `programDetailKey` re-exported from `.native` / `.web` / `.ts` variants.

**Shared offline-save helper (`src/services/syncService.ts`)**
- `saveWorkoutWithFallback(payload)` — saves to server when `NetInfo` reports
  connected (and the request succeeds), otherwise queues via `savePendingWorkout`
  and returns `null`. Centralizes the logic that was inline in
  `WorkoutSummaryScreen`. `syncPendingWorkouts` (app-active / reconnect) uploads
  the queue as before.

**Wired call sites**
- `HomeScreen` — `getProgramCached` for adherence; `getRecentWorkoutsCached` for
  weekly-completed dots + today's completed scheduled-activity ids, with
  client-side date filtering (the cached list is broad, so filter to this week /
  today in JS instead of relying on the server `start_date` param).
- `LastWorkoutCard`, `QuickStartSection` — `getRecentWorkoutsCached`.
- `HistoryScreen` — on network error for the default unfiltered first page, fall
  back to `getCachedRecentWorkouts`; filtered/paginated queries stay empty
  offline.
- `ProgramDetailScreen` — `getProgramCached`.
- `WorkoutSummaryScreen`, `LogActivityScreen`, `RecordManualScreen`,
  `ImportPreviewScreen` — all save via `saveWorkoutWithFallback`; offline saves
  show a "Saved offline — will sync when connected" alert and navigate home
  (GPS keeps its existing in-screen offline banner + History navigation).

## Tests

`src/__tests__/offlineFallback.test.ts` (6 cases, all passing): online save,
offline queue, connected-but-failed queue, fresh-fetch-caches, network-error
cache fallback, non-network rethrow.

## Notes / out of scope

- Workout *detail* (`getWorkout`) and analytics are not cached — opening a
  specific older workout offline that wasn't in the recent snapshot still fails.
- Post-workout Grit review is inherently online (server-generated); offline saves
  skip the review and surface the alert instead.
- Import dedupe (`markWorkoutImported`) is skipped on offline save since there's
  no server id yet.

## Files changed

- `src/services/cachedReads.ts` — new
- `src/services/syncService.ts` — `saveWorkoutWithFallback` + `newLocalWorkoutId`
- `src/services/offlineStorageTypes.ts` — `recentWorkouts`, `programDetailKey`, `CacheKey = string`
- `src/services/offlineStorage.native.ts` / `.web.ts` / `.ts` — re-export `programDetailKey`
- `src/screens/HomeScreen.tsx`, `HistoryScreen.tsx`, `ProgramDetailScreen.tsx`
- `src/screens/WorkoutSummaryScreen.tsx`, `LogActivityScreen.tsx`, `RecordManualScreen.tsx`, `ImportPreviewScreen.tsx`
- `src/components/LastWorkoutCard.tsx`, `QuickStartSection.tsx`
- `src/__tests__/offlineFallback.test.ts` — new
