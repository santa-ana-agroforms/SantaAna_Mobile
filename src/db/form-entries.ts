// src/db/form-entries.ts
import { all, ensureMigrated, getDb, run } from "@/db/sqlite";
import { FieldConfig } from "@/forms/runtime/field-registry";
import { scheduleTodayAt } from "@/notifications";

// Tipos mínimos (alineados a tu runtime)
export type Campo = {
  id_campo: string;
  sequence: number;
  tipo: string;
  clase: string;
  nombre_interno: string;
  etiqueta?: string | null;
  ayuda?: string | null;
  config?: FieldConfig;
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
  status: "pending" | "synced" | "ready_to_submit";
  cursor_page_index?: number;
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
  status: "pending" | "synced" | "ready_to_submit";
  fill_json: FilledState;
  form_json: FormJSON;
  /** NUEVO: página actual guardada (default 0 si no existe) */
  cursor_page_index: number;
};

export const toFieldConfig = (cfg: unknown): FieldConfig | undefined => {
  if (cfg == null) return undefined; // null/undefined -> undefined
  if (typeof cfg === "object") return cfg as FieldConfig; // {} u objeto -> OK
  return undefined; // si llega algo raro (string/num), lo descartas
};

// Helper: asegurar columna si no existe
const ensureColumn = async (table: string, column: string, ddl: string) => {
  const db = await getDb();
  const cols = await all<any>(`PRAGMA table_info(${table});`, []);
  const has = Array.isArray(cols) && cols.some((r) => r?.name === column);
  if (!has) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
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

  // NUEVO: columna para reanudar página
  await ensureColumn("form_entries", "cursor_page_index", "cursor_page_index INTEGER DEFAULT 0");
};

export const saveEntry = async (local_id: string, p: SavePayload) => {
  await ensureFormEntriesTables();

  // Insert/Replace incluyendo cursor_page_index
  await run(
    `INSERT OR REPLACE INTO form_entries
     (local_id, form_id, form_name, index_version_id, filled_at_local, status, fill_json, form_json, cursor_page_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      local_id,
      p.form_id,
      p.form_name,
      p.index_version_id,
      p.filled_at_local,
      p.status,
      JSON.stringify(p.fill_json),
      JSON.stringify(p.form_json),
      Number.isFinite(p.cursor_page_index as number) ? (p.cursor_page_index as number) : 0,
    ]
  );

  const reminder = await findReadyToSubmitReminder(0.1);
  // verificar si hoy es entre lunes a viernes
  const today = new Date();
  const dayOfWeek = today.getDay();
  if (reminder && dayOfWeek >= 1 && dayOfWeek <= 5) {
    // notificar a las 4 de la tarde
    await scheduleTodayAt(16, 0, reminder.title, reminder.body);
  } else if (reminder && dayOfWeek === 6) {
    // notificar a las 2 de la tarde
    await scheduleTodayAt(14, 0, reminder.title, reminder.body);
  }
};

export const listEntriesSummary = async (): Promise<EntrySummary[]> => {
  await ensureFormEntriesTables();
  const rows = await all<EntrySummary>(
    `SELECT local_id, form_name, index_version_id, filled_at_local
       FROM form_entries
      ORDER BY datetime(filled_at_local) DESC`,
    []
  );
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
    cursor_page_index: Number.isFinite(r.cursor_page_index) ? Number(r.cursor_page_index) : 0,
  };
};

export const getEntriesByFormId = async (form_id: string): Promise<SavedEntry[]> => {
  await ensureFormEntriesTables();
  const rows = await all<any>(
    `SELECT *
       FROM form_entries
      WHERE form_id = ?`,
    [form_id]
  );
  return (
    rows?.map((r) => ({
      local_id: r.local_id,
      form_id: r.form_id,
      form_name: r.form_name,
      index_version_id: r.index_version_id,
      filled_at_local: r.filled_at_local,
      status: (r.status as SavedEntry["status"]) ?? "pending",
      fill_json: JSON.parse(r.fill_json),
      form_json: JSON.parse(r.form_json),
      cursor_page_index: Number.isFinite(r.cursor_page_index) ? Number(r.cursor_page_index) : 0,
    })) ?? []
  );
};

export const markSynced = async (local_id: string) => {
  await ensureFormEntriesTables();
  await run(`UPDATE form_entries SET status = 'synced' WHERE local_id = ?`, [local_id]);
};

/** NUEVO: actualizar solamente el cursor de página */
export const updateCursor = async (local_id: string, pageIndex: number) => {
  await ensureFormEntriesTables();
  await run(`UPDATE form_entries SET cursor_page_index = ? WHERE local_id = ?`, [
    pageIndex,
    local_id,
  ]);
};

// Recordatorio cuando hay ready_to_submit viejos (basado en el más antiguo)
// Dedup: máximo 1 noti por día (key: noti.ready.<YYYY-MM-DD>)
export const findReadyToSubmitReminder = async (
  thresholdHours = 48
): Promise<{ title: string; body: string; count: number; oldestHours: number } | null> => {
  await ensureFormEntriesTables();
  await ensureMigrated();
  const db = await getDb();

  const [row] = await db.getAllAsync<{ c: number; oldest: string | null }>(`
    SELECT COUNT(*) AS c, MIN(filled_at_local) AS oldest
      FROM form_entries
     WHERE status = 'pending'
  `);
  console.log("Checking for ready_to_submit entries:", row);

  const count = Number(row?.c ?? 0);
  if (!count || !row?.oldest) return null;

  const oldest = new Date(row.oldest);
  const ageHours = Math.floor((Date.now() - oldest.getTime()) / 3600000);
  if (ageHours < thresholdHours) return null;

  // Solo una notificación por día
  const today = new Date().toISOString().slice(0, 10);
  const kvKey = `noti.ready.${today}`;
  const seen = await db.getAllAsync<{ v: string }>(`SELECT v FROM kv WHERE k = ? LIMIT 1`, [kvKey]);
  if (seen.length) return null;

  await db.runAsync(`INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)`, [kvKey, String(Date.now())]);

  const title = "Tienes formularios por enviar";

  // Mostrar 3 más viejos si hay ≥3; si no, 2 si hay ≥2; si no, 1.
  const listCount = count >= 3 ? 3 : count >= 2 ? 2 : 1;

  const forms = await db.getAllAsync<{ form_name: string; filled_at_local: string }>(
    `
    SELECT form_name, filled_at_local
      FROM form_entries
     WHERE status = 'pending'
     ORDER BY datetime(filled_at_local) ASC
     LIMIT ?
    `,
    [listCount]
  );

  const namesList = forms
    .map((f) => `- ${f.form_name} (completado el ${new Date(f.filled_at_local).toLocaleString()})`)
    .join("\n");

  const body =
    count === 1
      ? `Tienes 1 formulario listo para enviar desde hace ${ageHours} hora${ageHours !== 1 ? "s" : ""}:\n${namesList}`
      : `Tienes ${count} formularios listos para enviar; el más antiguo tiene ${ageHours} hora${ageHours !== 1 ? "s" : ""}. ${listCount === 3 ? "Los 3 más antiguos" : "Los 2 más antiguos"}:\n${namesList}`;

  console.log(
    `Notificación de recordatorio creada para ${count} formularios ready_to_submit (el más viejo tiene ${ageHours} horas).`
  );

  return { title, body, count, oldestHours: ageHours };
};

/** Elimina definitivamente un registro local por su local_id */
export const deleteEntry = async (local_id: string): Promise<void> => {
  await ensureFormEntriesTables();
  await run(`DELETE FROM form_entries WHERE local_id = ?`, [local_id]);
};

/** (Opcional) Elimina varios por lote */
export const deleteEntries = async (ids: string[]): Promise<void> => {
  if (!ids?.length) return;
  await ensureFormEntriesTables();

  // Construye placeholders (?, ?, ?, ...)
  const qs = ids.map(() => "?").join(",");
  await run(`DELETE FROM form_entries WHERE local_id IN (${qs})`, ids);
};
