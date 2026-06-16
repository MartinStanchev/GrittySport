// Cached, offline-resilient wrappers around read-only API calls. Each wrapper
// fetches fresh data and updates the on-device cache; if the request fails with
// a network error it falls back to the last cached snapshot so screens render
// instead of going blank offline. Non-network errors (auth, 4xx/5xx) still throw.
import {
  getProgram,
  getWorkouts,
  isNetworkError,
  type ProgramDetail,
  type WorkoutResponse,
} from './api';
import {
  CacheKeys,
  getCached,
  programDetailKey,
  setCached,
  type CacheKey,
} from './offlineStorage';

async function withCache<T>(key: CacheKey, fetcher: () => Promise<T>): Promise<T> {
  try {
    const data = await fetcher();
    void setCached(key, data);
    return data;
  } catch (e) {
    if (isNetworkError(e)) {
      const cached = await getCached<T>(key);
      if (cached != null) return cached;
    }
    throw e;
  }
}

export async function getProgramCached(programId: string): Promise<ProgramDetail> {
  return withCache(programDetailKey(programId), () => getProgram(programId));
}

// Broad recent-workout snapshot used by the home dashboard and as History's
// offline fallback. Fetching it keeps the cache warm for offline reads.
const RECENT_WORKOUTS_LIMIT = 50;

export async function getRecentWorkoutsCached(): Promise<WorkoutResponse[]> {
  return withCache(CacheKeys.recentWorkouts, () => getWorkouts({ limit: RECENT_WORKOUTS_LIMIT }));
}

export async function getCachedRecentWorkouts(): Promise<WorkoutResponse[]> {
  return (await getCached<WorkoutResponse[]>(CacheKeys.recentWorkouts)) ?? [];
}
