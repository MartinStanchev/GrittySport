import { Platform } from 'react-native';

const IS_NATIVE = Platform.OS === 'ios' || Platform.OS === 'android';

let _db: any = null;

async function getDB() {
  if (!IS_NATIVE) return null;
  if (!_db) {
    const SQLite = await import('expo-sqlite');
    _db = await SQLite.openDatabaseAsync('gritty.db');
    await _db.execAsync(`
      CREATE TABLE IF NOT EXISTS imported_healthkit_workouts (
        healthkit_uuid TEXT PRIMARY KEY,
        backend_workout_id TEXT NOT NULL,
        imported_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }
  return _db;
}

export async function isImported(healthkitUUID: string): Promise<boolean> {
  const db = await getDB();
  if (!db) return false;
  const row = await db.getFirstAsync(
    'SELECT 1 FROM imported_healthkit_workouts WHERE healthkit_uuid = ?',
    [healthkitUUID],
  );
  return row != null;
}

export async function markImported(
  healthkitUUID: string,
  backendWorkoutId: string,
): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.runAsync(
    `INSERT OR REPLACE INTO imported_healthkit_workouts (healthkit_uuid, backend_workout_id)
     VALUES (?, ?)`,
    [healthkitUUID, backendWorkoutId],
  );
}

export async function getImportedUUIDs(): Promise<Set<string>> {
  const db = await getDB();
  if (!db) return new Set();
  const rows: { healthkit_uuid: string }[] = await db.getAllAsync(
    'SELECT healthkit_uuid FROM imported_healthkit_workouts',
  );
  return new Set(rows.map((r) => r.healthkit_uuid));
}
