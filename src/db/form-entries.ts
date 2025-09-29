// src/db/form-entries.ts
import { all, ensureMigrated, getDb, run } from "@/db/sqlite";

// Tipos mínimos (alineados a tu runtime)
export type Campo = {
  id_campo: string;
  sequence: number;
  tipo: string;
  clase: string;
  nombre_interno: string;
  etiqueta?: string | null;
  ayuda?: string | null;
  config?: unknown | null;
  requerido?: boolean;
};

export type Pagina = {
  id_pagina: string;
  secuencia?: number | null;
  nombre: string;
  descripcion?: string | null;
  pagina_version: { id: string; fecha_creacion: string };
  campos: Campo[];
};

export type FormJSON = {
  id_formulario: string;
  nombre: string;
  version_vigente: { id_index_version: string; fecha_creacion: string };
  paginas: Pagina[];
};

export type PageState = Record<string, any>;
export type FilledState = Record<string, PageState>;

export type SavePayload = {
  form_id: string;
  form_name: string;
  index_version_id: string;
  filled_at_local: string; // ISO local del teléfono
  fill_json: FilledState;
  form_json: FormJSON;
  status: "pending" | "synced" | "cancelled";
};

export type EntrySummary = {
  local_id: string;
  form_name: string;
  index_version_id: string;
  filled_at_local: string;
};

export type SavedEntry = {
  local_id: string;
  form_id: string;
  form_name: string;
  index_version_id: string;
  filled_at_local: string;
  status: "pending" | "synced" | "cancelled";
  fill_json: FilledState;
  form_json: FormJSON;
};

// Crea la(s) tabla(s) si no existen (no cambia tu user_version)
const ensureFormEntriesTables = async () => {
  await ensureMigrated(); // por si aún no corrieron tus migraciones base
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS form_entries (
      local_id         TEXT PRIMARY KEY,
      form_id          TEXT NOT NULL,
      form_name        TEXT NOT NULL,
      index_version_id TEXT NOT NULL,
      filled_at_local  TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'pending',
      fill_json        TEXT NOT NULL,
      form_json        TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_form_entries_status ON form_entries(status);
    CREATE INDEX IF NOT EXISTS idx_form_entries_time   ON form_entries(filled_at_local);
  `);
};

export const saveEntry = async (local_id: string, p: SavePayload) => {
  await ensureFormEntriesTables();
  // Delete if exist a entrie with same local_id
  await run(`DELETE FROM form_entries WHERE local_id = ?`, [local_id]);
  // Insert new entry
  await run(
    `INSERT OR REPLACE INTO form_entries
     (local_id, form_id, form_name, index_version_id, filled_at_local, status, fill_json, form_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      local_id,
      p.form_id,
      p.form_name,
      p.index_version_id,
      p.filled_at_local,
      p.status,
      JSON.stringify(p.fill_json),
      JSON.stringify(p.form_json),
    ]
  );
};

export const listEntriesSummary = async (): Promise<EntrySummary[]> => {
  await ensureFormEntriesTables();
  const rows = await all<EntrySummary>(
    `SELECT local_id, form_name, index_version_id, filled_at_local
       FROM form_entries
      ORDER BY datetime(filled_at_local) DESC`,
    []
  );
  console.log("Entries summary:", rows, rows ?? []);
  return rows ?? [];
};

export const getEntryById = async (local_id: string): Promise<SavedEntry | null> => {
  await ensureFormEntriesTables();
  const rows = await all<any>(
    `SELECT *
       FROM form_entries
      WHERE local_id = ?
      LIMIT 1`,
    [local_id]
  );
  if (!rows || !rows[0]) return null;

  const r = rows[0];
  return {
    local_id: r.local_id,
    form_id: r.form_id,
    form_name: r.form_name,
    index_version_id: r.index_version_id,
    filled_at_local: r.filled_at_local,
    status: (r.status as SavedEntry["status"]) ?? "pending",
    fill_json: JSON.parse(r.fill_json),
    form_json: JSON.parse(r.form_json),
  };
};

export const markSynced = async (local_id: string) => {
  await ensureFormEntriesTables();
  await run(`UPDATE form_entries SET status = 'synced' WHERE local_id = ?`, [local_id]);
};
