import { Platform } from 'react-native';

const IS_NATIVE = Platform.OS === 'ios' || Platform.OS === 'android';

let _db: any = null;

// Tracks workouts already pulled from a third-party source (Apple Health,
// Health Connect, etc.) so the import list can grey them out. Source-agnostic:
// (source, external_id) is the natural key.
async function getDB() {
  if (!IS_NATIVE) return null;
  if (!_db) {
    const SQLite = await import('expo-sqlite');
    _db = await SQLite.openDatabaseAsync('gritty.db');
    await _db.execAsync(`
      CREATE TABLE IF NOT EXISTS imported_external_workouts (
        source TEXT NOT NULL,
        external_id TEXT NOT NULL,
        backend_workout_id TEXT NOT NULL,
        imported_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (source, external_id)
      );
    `);
    await migrateLegacyHealthKitTable(_db);
  }
  return _db;
}

// Move rows from the original iOS-only table into the unified table, then
// drop it. Idempotent — if the legacy table is absent the no-ops succeed.
async function migrateLegacyHealthKitTable(db: any): Promise<void> {
  await db.execAsync(`
    INSERT OR IGNORE INTO imported_external_workouts (source, external_id, backend_workout_id, imported_at)
      SELECT 'apple_health', healthkit_uuid, backend_workout_id, imported_at
      FROM imported_healthkit_workouts
      WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='imported_healthkit_workouts');
  `).catch(() => {});
  await db.execAsync(`DROP TABLE IF EXISTS imported_healthkit_workouts;`).catch(() => {});
}

export async function isImported(source: string, externalId: string): Promise<boolean> {
  const db = await getDB();
  if (!db) return false;
  const row = await db.getFirstAsync(
    'SELECT 1 FROM imported_external_workouts WHERE source = ? AND external_id = ?',
    [source, externalId],
  );
  return row != null;
}

export async function markImported(
  source: string,
  externalId: string,
  backendWorkoutId: string,
): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.runAsync(
    `INSERT OR REPLACE INTO imported_external_workouts (source, external_id, backend_workout_id)
     VALUES (?, ?, ?)`,
    [source, externalId, backendWorkoutId],
  );
}

export async function getImportedKeys(source: string): Promise<Set<string>> {
  const db = await getDB();
  if (!db) return new Set();
  const rows: { external_id: string }[] = await db.getAllAsync(
    'SELECT external_id FROM imported_external_workouts WHERE source = ?',
    [source],
  );
  return new Set(rows.map((r) => r.external_id));
}
