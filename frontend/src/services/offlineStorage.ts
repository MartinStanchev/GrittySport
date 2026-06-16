// TypeScript fallback — Metro prefers offlineStorage.native.ts or offlineStorage.web.ts at runtime.
import type { CacheKey, LocalPendingWorkout } from './offlineStorageTypes';

export { CacheKeys, programDetailKey } from './offlineStorageTypes';
export type { CacheKey, LocalPendingWorkout } from './offlineStorageTypes';

export async function savePendingWorkout(_workout: LocalPendingWorkout): Promise<void> {}
export async function getPendingWorkouts(): Promise<LocalPendingWorkout[]> { return []; }
export async function markSynced(_id: string): Promise<void> {}
export async function clearSynced(): Promise<void> {}

export async function setCached<T>(_key: CacheKey, _value: T): Promise<void> {}
export async function getCached<T>(_key: CacheKey): Promise<T | null> { return null; }
export async function clearCached(_key: CacheKey): Promise<void> {}
export async function clearAllLocalData(): Promise<void> {}
