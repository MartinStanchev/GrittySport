// Web stub — expo-sqlite is native-only. Pending workout queue is not supported,
// but cache_kv is backed by localStorage so offline reads still work in the browser.
import type { CacheKey, LocalPendingWorkout } from './offlineStorageTypes';

export { CacheKeys } from './offlineStorageTypes';
export type { CacheKey, LocalPendingWorkout } from './offlineStorageTypes';

export async function savePendingWorkout(_workout: LocalPendingWorkout): Promise<void> {}
export async function getPendingWorkouts(): Promise<LocalPendingWorkout[]> { return []; }
export async function markSynced(_id: string): Promise<void> {}
export async function clearSynced(): Promise<void> {}

const CACHE_PREFIX = 'gritty:cache:';

export async function setCached<T>(key: CacheKey, value: T): Promise<void> {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    // localStorage unavailable or quota exceeded — fail silently
  }
}

export async function getCached<T>(key: CacheKey): Promise<T | null> {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function clearCached(key: CacheKey): Promise<void> {
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch {
    // Cache delete is best-effort.
  }
}

export async function clearAllLocalData(): Promise<void> {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Cache clear is best-effort.
  }
}
