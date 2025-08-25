// src/db/sqlite.ts
import * as SQLite from "expo-sqlite";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
function getDb() {
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync("forms.db");
  return dbPromise;
}

// Pequeños helpers
export async function run(sql: string, params: any[] = []) {
  const db = await getDb();
  return db.runAsync(sql, params);
}
export async function all<T = any>(sql: string, params: any[] = []) {
  const db = await getDb();
  return db.getAllAsync<T>(sql, params);
}

let migrated = false;
export async function ensureMigrated() {
  if (migrated) return;
  const db = await getDb();

  // Usa una transacción real (no 'BEGIN' como string)
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
      CREATE TABLE IF NOT EXISTS user (
        nombre TEXT,
        nombre_de_usuario TEXT PRIMARY KEY
      );
      CREATE TABLE IF NOT EXISTS user_role (
        nombre_de_usuario TEXT,
        rol_id TEXT,
        rol_nombre TEXT,
        PRIMARY KEY (nombre_de_usuario, rol_id)
      );
      CREATE TABLE IF NOT EXISTS form (
        id TEXT PRIMARY KEY,
        nombre TEXT,
        index_version_id TEXT,
        index_version_fecha TEXT
      );
      CREATE TABLE IF NOT EXISTS page (
        id TEXT PRIMARY KEY,
        form_id TEXT,
        secuencia INTEGER,
        nombre TEXT,
        descripcion TEXT,
        version_id TEXT,
        version_fecha TEXT
      );
      CREATE TABLE IF NOT EXISTS field (
        id TEXT PRIMARY KEY,
        page_version_id TEXT,
        sequence INTEGER,
        tipo TEXT,
        clase TEXT,
        nombre_interno TEXT,
        etiqueta TEXT,
        ayuda TEXT,
        config TEXT,
        requerido INTEGER
      );
      CREATE TABLE IF NOT EXISTS pending_submission (
        id TEXT PRIMARY KEY,
        form_id TEXT,
        payload TEXT,
        created_at TEXT
      );
    `);
  });

  migrated = true;
}

// API pública
export const DB = { run, all, ensureMigrated };
