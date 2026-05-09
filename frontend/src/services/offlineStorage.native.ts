import * as SQLite from 'expo-sqlite';
import type { CacheKey, LocalPendingWorkout } from './offlineStorageTypes';

export { CacheKeys } from './offlineStorageTypes';
export type { CacheKey, LocalPendingWorkout } from './offlineStorageTypes';

const DB_NAME = 'gritty.db';

let db: SQLite.SQLiteDatabase | null = null;

async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pending_workouts (
        id TEXT PRIMARY KEY,
        activity_type TEXT NOT NULL,
        recorded_data TEXT NOT NULL,
        gps_route TEXT,
        heart_rate_data TEXT,
        source TEXT NOT NULL DEFAULT 'gps',
        started_at TEXT NOT NULL,
        finished_at TEXT,
        scheduled_activity_id TEXT,
        notes TEXT,
        synced INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS cache_kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }
  return db;
}

export async function savePendingWorkout(workout: LocalPendingWorkout): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    `INSERT INTO pending_workouts
      (id, activity_type, recorded_data, gps_route, heart_rate_data, source, started_at, finished_at, scheduled_activity_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      workout.id,
      workout.activity_type,
      workout.recorded_data,
      workout.gps_route ?? null,
      workout.heart_rate_data ?? null,
      workout.source,
      workout.started_at,
      workout.finished_at ?? null,
      workout.scheduled_activity_id ?? null,
      workout.notes ?? null,
    ]
  );
}

export async function getPendingWorkouts(): Promise<LocalPendingWorkout[]> {
  const database = await getDB();
  return database.getAllAsync<LocalPendingWorkout>(
    `SELECT id, activity_type, recorded_data, gps_route, heart_rate_data, source,
            started_at, finished_at, scheduled_activity_id, notes
     FROM pending_workouts WHERE synced = 0`
  );
}

export async function markSynced(id: string): Promise<void> {
  const database = await getDB();
  await database.runAsync(`UPDATE pending_workouts SET synced = 1 WHERE id = ?`, [id]);
}

export async function clearSynced(): Promise<void> {
  const database = await getDB();
  await database.runAsync(`DELETE FROM pending_workouts WHERE synced = 1`);
}

export async function setCached<T>(key: CacheKey, value: T): Promise<void> {
  try {
    const database = await getDB();
    await database.runAsync(
      `INSERT OR REPLACE INTO cache_kv (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
      [key, JSON.stringify(value)],
    );
  } catch {
    // Cache write is best-effort — never fail an otherwise-successful fetch.
  }
}

export async function getCached<T>(key: CacheKey): Promise<T | null> {
  try {
    const database = await getDB();
    const row = await database.getFirstAsync<{ value: string }>(
      `SELECT value FROM cache_kv WHERE key = ?`,
      [key],
    );
    if (!row) return null;
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function clearCached(key: CacheKey): Promise<void> {
  try {
    const database = await getDB();
    await database.runAsync(`DELETE FROM cache_kv WHERE key = ?`, [key]);
  } catch {
    // Cache delete is best-effort.
  }
}

export async function clearAllLocalData(): Promise<void> {
  try {
    const database = await getDB();
    await database.execAsync('DELETE FROM cache_kv; DELETE FROM pending_workouts;');
  } catch {
    // Cache clear is best-effort.
  }
}
