import * as SQLite from 'expo-sqlite';

const DB_NAME = 'gritty.db';

export interface LocalPendingWorkout {
  id: string;
  activity_type: string;
  recorded_data: string; // JSON string
  gps_route?: string; // JSON string
  heart_rate_data?: string; // JSON string
  source: string;
  started_at: string;
  finished_at?: string;
  scheduled_activity_id?: string;
  notes?: string;
}

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
