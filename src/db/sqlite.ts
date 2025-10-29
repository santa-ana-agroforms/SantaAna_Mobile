// src/db/sqlite.ts
import * as SQLite from "expo-sqlite";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
export const getDb = async () => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("forms.db", { useNewConnection: true });
    const db = await dbPromise;
    await db.execAsync("PRAGMA foreign_keys = ON;");
    await db.execAsync("PRAGMA journal_mode = WAL;");
  }
  return dbPromise!;
};

// Helpers base
export const run = async (sql: string, params: any[] = []) => {
  const db = await getDb();
  return db.runAsync(sql, params);
};
export const all = async <T = any>(sql: string, params: any[] = []) => {
  const db = await getDb();
  return db.getAllAsync<T>(sql, params);
};

// --- Migraciones persistentes con PRAGMA user_version ---
let migrated = false;
export const ensureMigrated = async () => {
  if (migrated) return;
  const db = await getDb();

  await db.withTransactionAsync(async () => {
    const uvRows = await db.getAllAsync<{ user_version: number }>("PRAGMA user_version;");
    let ver = (uvRows?.[0]?.user_version ?? 0) | 0;

    if (ver < 1) {
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
      await db.execAsync("PRAGMA user_version = 1;");
      ver = 1;
    }

    if (ver < 2) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS category (
          id TEXT PRIMARY KEY,
          nombre TEXT NOT NULL,
          descripcion TEXT
        );
      `);
      const cols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(form);");
      const hasCategoria = cols.some((c) => c.name === "categoria_id");
      if (!hasCategoria) {
        await db.execAsync(`ALTER TABLE form ADD COLUMN categoria_id TEXT;`);
      }
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_form_categoria_id ON form(categoria_id);`);
      await db.execAsync("PRAGMA user_version = 2;");
      ver = 2;
    }

    // v3: disponibilidad y periodicidad
    if (ver < 3) {
      const cols3 = await db.getAllAsync<{ name: string }>("PRAGMA table_info(form);");
      const hasDesde = cols3.some((c) => c.name === "disponible_desde");
      const hasHasta = cols3.some((c) => c.name === "disponible_hasta");
      const hasPer = cols3.some((c) => c.name === "periodicidad");

      if (!hasDesde) await db.execAsync(`ALTER TABLE form ADD COLUMN disponible_desde TEXT;`);
      if (!hasHasta) await db.execAsync(`ALTER TABLE form ADD COLUMN disponible_hasta TEXT;`);
      if (!hasPer) await db.execAsync(`ALTER TABLE form ADD COLUMN periodicidad INTEGER;`);

      await db.execAsync(
        `CREATE INDEX IF NOT EXISTS idx_form_disp_desde ON form(disponible_desde);`
      );
      await db.execAsync(
        `CREATE INDEX IF NOT EXISTS idx_form_disp_hasta ON form(disponible_hasta);`
      );
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_form_periodicidad ON form(periodicidad);`);

      await db.execAsync("PRAGMA user_version = 3;");
      ver = 3;
    }

    // v4: uso local (última vez llenado)
    if (ver < 4) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS form_usage (
          form_id TEXT PRIMARY KEY,
          last_filled_at TEXT NOT NULL
        );
      `);
      await db.execAsync(
        `CREATE INDEX IF NOT EXISTS idx_form_usage_last ON form_usage(last_filled_at);`
      );
      await db.execAsync("PRAGMA user_version = 4;");
      ver = 4;
    }
  });

  migrated = true;
};

// === Esquema local para GRUPOS ===
const ensureGroupsTables = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS local_groups (
      id_grupo   TEXT PRIMARY KEY,
      nombre     TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS local_group_fields (
      id_grupo           TEXT NOT NULL,
      id_campo           TEXT NOT NULL,
      sequence           INTEGER NOT NULL,
      tipo               TEXT NOT NULL,
      clase              TEXT NOT NULL,
      nombre_interno     TEXT NOT NULL,
      etiqueta           TEXT,
      ayuda              TEXT,
      config_json        TEXT,
      requerido          INTEGER NOT NULL, -- 0/1

      pagina_id          TEXT NOT NULL,
      pagina_nombre      TEXT NOT NULL,
      pagina_secuencia   INTEGER,

      PRIMARY KEY (id_grupo, id_campo),
      FOREIGN KEY (id_grupo) REFERENCES local_groups(id_grupo) ON DELETE CASCADE
    )
  `);

  await run(
    `CREATE INDEX IF NOT EXISTS idx_lgf_grupo_seq ON local_group_fields (id_grupo, pagina_secuencia, sequence)`
  );
  await run(`CREATE INDEX IF NOT EXISTS idx_lgf_pagina ON local_group_fields (pagina_id)`);
};

const serializeGroupField = (f: any) => [
  f.pagina?.id_pagina,
  f.pagina?.nombre ?? "",
  f.pagina?.secuencia ?? null,
  f.id_campo,
  f.sequence,
  f.tipo,
  f.clase,
  f.nombre_interno,
  f.etiqueta ?? null,
  f.ayuda ?? null,
  JSON.stringify(f.config ?? null),
  f.requerido ? 1 : 0,
];

const rowToGroupField = (r: any) => ({
  id_campo: r.id_campo,
  sequence: Number(r.sequence),
  tipo: r.tipo,
  clase: r.clase,
  nombre_interno: r.nombre_interno,
  etiqueta: r.etiqueta ?? null,
  ayuda: r.ayuda ?? null,
  config: r.config_json ? JSON.parse(r.config_json) : null,
  requerido: Number(r.requerido) === 1,
  pagina: {
    id_pagina: r.pagina_id,
    nombre: r.pagina_nombre,
    secuencia: r.pagina_secuencia == null ? null : Number(r.pagina_secuencia),
  },
});

// Inserta/actualiza UN grupo y reemplaza sus campos
export const upsertGroup = async (group: { id_grupo: string; nombre: string; campos: any[] }) => {
  await ensureGroupsTables();
  await run(
    `INSERT INTO local_groups (id_grupo, nombre) VALUES (?, ?)
     ON CONFLICT(id_grupo) DO UPDATE SET nombre = excluded.nombre`,
    [group.id_grupo, group.nombre]
  );
  await run(`DELETE FROM local_group_fields WHERE id_grupo = ?`, [group.id_grupo]);

  if (group.campos?.length) {
    const sql = `
      INSERT INTO local_group_fields (
        pagina_id, pagina_nombre, pagina_secuencia,
        id_campo, sequence, tipo, clase, nombre_interno,
        etiqueta, ayuda, config_json, requerido,
        id_grupo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    for (const f of group.campos) {
      const params = serializeGroupField(f);
      await run(sql, [...params, group.id_grupo]);
    }
  }
};

export const upsertGroups = async (
  groups: { id_grupo: string; nombre: string; campos: any[] }[]
) => {
  await ensureGroupsTables();
  for (const g of groups) await upsertGroup(g);
};

export const selectGroups = async () => {
  await ensureGroupsTables();

  const groups = await all<{ id_grupo: string; nombre: string }>(
    `SELECT id_grupo, nombre FROM local_groups ORDER BY nombre ASC`
  );

  const out: any[] = [];
  for (const g of groups) {
    const rows = await all<any>(
      `SELECT *
         FROM local_group_fields
        WHERE id_grupo = ?
        ORDER BY COALESCE(pagina_secuencia, 0) ASC, sequence ASC, id_campo ASC`,
      [g.id_grupo]
    );
    out.push({
      id_grupo: g.id_grupo,
      nombre: g.nombre,
      campos: rows.map(rowToGroupField),
    });
  }
  return out;
};

// Selecciona un grupo por id (con sus campos)
export const selectGroupById = async (id_grupo: string) => {
  await ensureGroupsTables();

  const groups = await all<{ id_grupo: string; nombre: string }>(
    `SELECT id_grupo, nombre FROM local_groups WHERE id_grupo = ? LIMIT 1`,
    [id_grupo]
  );
  if (!groups.length) return null;

  const rows = await all<any>(
    `SELECT *
       FROM local_group_fields
      WHERE id_grupo = ?
      ORDER BY COALESCE(pagina_secuencia, 0) ASC, sequence ASC, id_campo ASC`,
    [id_grupo]
  );

  return {
    id_grupo,
    nombre: groups[0].nombre,
    campos: rows.map(rowToGroupField),
  };
};

export const clearGroups = async () => {
  await ensureGroupsTables();
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM local_group_fields`);
    await db.runAsync(`DELETE FROM local_groups`);
  });
};

export const clearGroupById = async (id_grupo: string) => {
  await ensureGroupsTables();
  await run(`DELETE FROM local_group_fields WHERE id_grupo = ?`, [id_grupo]);
  await run(`DELETE FROM local_groups WHERE id_grupo = ?`, [id_grupo]);
};

// ---------------------------------------------
// Sync offline (formularios)
// ---------------------------------------------

const slugFromCategoryName = (name?: string | null) => {
  if (!name || !name.trim()) return "__SIN_CATEGORIA__";
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

type ServerField = {
  id_campo: string;
  sequence: number;
  tipo: string;
  clase: string;
  nombre_interno: string;
  etiqueta: string | null;
  ayuda: string | null;
  config: unknown | null;
  requerido: boolean;
};

type ServerPage = {
  id_pagina: string;
  secuencia: number | null;
  nombre: string;
  descripcion: string | null;
  pagina_version: { id: string; fecha_creacion: string };
  campos: ServerField[];
};

type ServerForm = {
  id_formulario: string;
  nombre: string;
  version_vigente: { id_index_version: string; fecha_creacion: string };
  periodicidad: number | null;
  disponibilidad: { desde: string | null; hasta: string | null };
  disponible?: boolean;
  paginas: ServerPage[];
};

export type ServerCategoryGroup = {
  nombre_categoria: string;
  descripcion: string | null;
  formularios: ServerForm[];
};

// ------------------ Uso local ------------------
export const setFormLastFilled = async (formId: string, whenISO?: string) => {
  await ensureMigrated();
  const ts = whenISO ?? new Date().toISOString();
  await run(
    `INSERT INTO form_usage (form_id, last_filled_at)
     VALUES (?, ?)
     ON CONFLICT(form_id)
     DO UPDATE SET last_filled_at = excluded.last_filled_at`,
    [formId, ts]
  );
};

export const getFormLastFilledMap = async (): Promise<Record<string, string>> => {
  await ensureMigrated();
  const rows = await all<{ form_id: string; last_filled_at: string }>(
    `SELECT form_id, last_filled_at FROM form_usage`
  );
  const map: Record<string, string> = {};
  for (const r of rows) map[r.form_id] = r.last_filled_at;
  return map;
};

// ---------- Helpers de tiempo (Guatemala, UTC-6 fijo) ----------
const GT_OFFSET_MS = 6 * 60 * 60 * 1000;

const isDateOnly = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const parseInGT = (s: string): Date | null => {
  if (!s) return null;
  if (isDateOnly(s)) return new Date(`${s}T00:00:00-06:00`);
  const d = new Date(s);
  return Number.isNaN(+d) ? null : d;
};
const toGtEpochDay = (d: Date) => Math.floor((d.getTime() - GT_OFFSET_MS) / 86400000);
const fromGtEpochDayMidnight = (day: number) => new Date(day * 86400000 + GT_OFFSET_MS);
const endOfDayGT = (d: Date) => new Date(fromGtEpochDayMidnight(toGtEpochDay(d) + 1).getTime() - 1);

const getPeriodStartGT = (start: Date, periodDays: number, now: Date) => {
  const startDay = toGtEpochDay(start);
  const nowDay = toGtEpochDay(now);
  const deltaDays = nowDay - startDay;
  const k = Math.floor(deltaDays / periodDays);
  const currStartDay = startDay + Math.max(0, k) * periodDays;
  return fromGtEpochDayMidnight(currStartDay);
};
const isWithinWindowGT = (now: Date, desde?: Date | null, hasta?: Date | null) => {
  if (desde && now < desde) return false;
  if (hasta) {
    const hastaEnd = endOfDayGT(hasta);
    if (now > hastaEnd) return false;
  }
  return true;
};
const isFilledInCurrentPeriod = (lastFill: Date | null, periodStart: Date, periodDays: number) => {
  if (!lastFill) return false;
  const startMs = periodStart.getTime();
  const endMs = fromGtEpochDayMidnight(toGtEpochDay(periodStart) + periodDays).getTime();
  const t = lastFill.getTime();
  return t >= startMs && t < endMs;
};

// ---------- upsert SIN transacción (uso interno) ----------
const upsertGroupedFormsNoTx = async (db: SQLite.SQLiteDatabase, groups: ServerCategoryGroup[]) => {
  for (const cat of groups) {
    const catId = slugFromCategoryName(cat.nombre_categoria);
    await db.runAsync(
      `INSERT OR REPLACE INTO category (id, nombre, descripcion) VALUES (?, ?, ?);`,
      [catId, cat.nombre_categoria, cat.descripcion ?? null]
    );

    for (const form of cat.formularios) {
      // limpiar páginas/campos del form
      await db.runAsync(
        `DELETE FROM field WHERE page_version_id IN (SELECT version_id FROM page WHERE form_id = ?);`,
        [form.id_formulario]
      );
      await db.runAsync(`DELETE FROM page WHERE form_id = ?;`, [form.id_formulario]);

      await db.runAsync(
        `INSERT OR REPLACE INTO form
          (id, nombre, index_version_id, index_version_fecha, categoria_id, disponible_desde, disponible_hasta, periodicidad)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          form.id_formulario,
          form.nombre,
          form.version_vigente.id_index_version,
          form.version_vigente.fecha_creacion,
          catId,
          form.disponibilidad?.desde ?? null,
          form.disponibilidad?.hasta ?? null,
          form.periodicidad ?? null,
        ]
      );

      for (const p of form.paginas) {
        await db.runAsync(
          `INSERT OR REPLACE INTO page (id, form_id, secuencia, nombre, descripcion, version_id, version_fecha)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [
            p.id_pagina,
            form.id_formulario,
            p.secuencia ?? null,
            p.nombre,
            p.descripcion ?? null,
            p.pagina_version.id,
            p.pagina_version.fecha_creacion,
          ]
        );

        for (const f of p.campos) {
          await db.runAsync(
            `INSERT OR REPLACE INTO field
             (id, page_version_id, sequence, tipo, clase, nombre_interno, etiqueta, ayuda, config, requerido)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              f.id_campo,
              p.pagina_version.id,
              f.sequence,
              f.tipo,
              f.clase,
              f.nombre_interno,
              f.etiqueta ?? null,
              f.ayuda ?? null,
              f.config == null ? null : JSON.stringify(f.config),
              f.requerido ? 1 : 0,
            ]
          );
        }
      }
    }
  }
};

// ---------- UPSERT (público) con UNA transacción ----------
export const upsertGroupedForms = async (groups: ServerCategoryGroup[]) => {
  await ensureMigrated();
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await upsertGroupedFormsNoTx(db, groups);
  });
};

// ---------- REPLACE SNAPSHOT (autoritativo + poda atómica) ----------
export const replaceFormsSnapshot = async (groups: ServerCategoryGroup[]) => {
  await ensureMigrated();
  const db = await getDb();

  // Recolectar llaves “a conservar”
  const keepCatIds: string[] = [];
  const keepFormIds: string[] = [];
  const keepPageIds: string[] = [];
  const keepPageVersionIds: string[] = [];

  for (const cat of groups ?? []) {
    const catId = slugFromCategoryName(cat.nombre_categoria);
    keepCatIds.push(catId);

    for (const form of cat.formularios ?? []) {
      keepFormIds.push(form.id_formulario);
      for (const p of form.paginas ?? []) {
        keepPageIds.push(p.id_pagina);
        keepPageVersionIds.push(p.pagina_version.id);
      }
    }
  }

  const makeIn = (arr: any[]) => (arr.length ? `(${arr.map(() => "?").join(",")})` : null);

  await db.withTransactionAsync(async () => {
    // 1) Upsert TODO el snapshot (sin abrir otra transacción)
    await upsertGroupedFormsNoTx(db, groups);

    // 2) Podar lo que NO esté en el snapshot
    if (keepPageVersionIds.length) {
      await db.runAsync(
        `DELETE FROM field WHERE page_version_id NOT IN ${makeIn(keepPageVersionIds)};`,
        keepPageVersionIds
      );
    } else {
      await db.runAsync(`DELETE FROM field;`);
    }

    if (keepPageIds.length) {
      await db.runAsync(`DELETE FROM page WHERE id NOT IN ${makeIn(keepPageIds)};`, keepPageIds);
    } else {
      await db.runAsync(`DELETE FROM page;`);
    }

    if (keepFormIds.length) {
      await db.runAsync(`DELETE FROM form WHERE id NOT IN ${makeIn(keepFormIds)};`, keepFormIds);
    } else {
      await db.runAsync(`DELETE FROM form;`);
    }

    if (keepCatIds.length) {
      await db.runAsync(`DELETE FROM category WHERE id NOT IN ${makeIn(keepCatIds)};`, keepCatIds);
    } else {
      await db.runAsync(`DELETE FROM category;`);
    }
  });
};

// Guarda envío y devuelve disponibilidad recalculada (GT)
export const markFormSubmitted = async (
  formId: string,
  when?: Date | string
): Promise<{ form_id: string; last_filled_at: string; disponible: boolean }> => {
  await ensureMigrated();
  const db = await getDb();

  const ts =
    when instanceof Date
      ? when.toISOString()
      : typeof when === "string"
        ? new Date(when).toISOString()
        : new Date().toISOString();

  // 1) persistir última vez llenado
  await db.runAsync(
    `INSERT INTO form_usage (form_id, last_filled_at)
     VALUES (?, ?)
     ON CONFLICT(form_id) DO UPDATE SET last_filled_at = excluded.last_filled_at`,
    [formId, ts]
  );

  // 2) traer metadatos del form para calcular disponibilidad
  const [meta] = await db.getAllAsync<{
    disponible_desde: string | null;
    disponible_hasta: string | null;
    periodicidad: number | null;
  }>(
    `SELECT disponible_desde, disponible_hasta, periodicidad
       FROM form
      WHERE id = ?
      LIMIT 1`,
    [formId]
  );

  // ---- helpers inline (GT: UTC-6, sin DST) ----
  const isDateOnly = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const parseInGT = (s?: string | null): Date | null => {
    if (!s) return null;
    return isDateOnly(s) ? new Date(`${s}T00:00:00-06:00`) : new Date(s);
  };
  const GT_OFFSET_MS = 6 * 60 * 60 * 1000;
  const toGtDay = (d: Date) => Math.floor((d.getTime() - GT_OFFSET_MS) / 86400000);
  const fromGtDay = (day: number) => new Date(day * 86400000 + GT_OFFSET_MS);
  const endOfDayGT = (d: Date) => new Date(fromGtDay(toGtDay(d) + 1).getTime() - 1);

  const isWithinWindow = (now: Date, desde?: Date | null, hasta?: Date | null) => {
    if (desde && now < desde) return false;
    if (hasta && now > endOfDayGT(hasta)) return false;
    return true;
  };
  const getPeriodStart = (start: Date, days: number, now: Date) => {
    const k = Math.floor((toGtDay(now) - toGtDay(start)) / days);
    const startDay = toGtDay(start) + Math.max(0, k) * days;
    return fromGtDay(startDay);
  };
  const isFilledThisPeriod = (last: Date, periodStart: Date, days: number) => {
    const startMs = periodStart.getTime();
    const endMs = fromGtDay(toGtDay(periodStart) + days).getTime();
    const t = last.getTime();
    return t >= startMs && t < endMs;
  };
  // ---------------------------------------------

  const now = new Date(ts);
  const desde = parseInGT(meta?.disponible_desde ?? null);
  const hasta = parseInGT(meta?.disponible_hasta ?? null);
  const period = meta?.periodicidad ? Number(meta.periodicidad) : null;

  const windowOK = isWithinWindow(now, desde, hasta);
  let periodOK = true;
  if (period && period > 0 && desde) {
    const pStart = getPeriodStart(desde, period, now);
    // como “acabas de llenar”, last = now → caerá en el periodo actual
    periodOK = !isFilledThisPeriod(now, pStart, period);
  }

  const disponible = windowOK && periodOK; // normalmente false tras enviar si hay periodicidad

  return { form_id: formId, last_filled_at: ts, disponible };
};

// --- Notificaciones de disponibilidad por período/ventana (Guatemala) ---
export const computeAvailabilityNotifications = async (): Promise<
  { form_id: string; title: string; body: string }[]
> => {
  await ensureMigrated();
  const db = await getDb();

  // helpers GT (UTC-6, sin DST)
  const GT_OFFSET_MS = 6 * 60 * 60 * 1000;
  const isDateOnly = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const parseInGT = (s?: string | null): Date | null => {
    if (!s) return null;
    return isDateOnly(s) ? new Date(`${s}T00:00:00-06:00`) : new Date(s);
  };
  const toGtDay = (d: Date) => Math.floor((d.getTime() - GT_OFFSET_MS) / 86400000);
  const fromGtDay = (day: number) => new Date(day * 86400000 + GT_OFFSET_MS);
  const endOfDayGT = (d: Date) => new Date(fromGtDay(toGtDay(d) + 1).getTime() - 1);

  const isWithinWindow = (now: Date, desde?: Date | null, hasta?: Date | null) => {
    if (desde && now < desde) return false;
    if (hasta && now > endOfDayGT(hasta)) return false;
    return true;
  };

  const forms = await db.getAllAsync<{
    id: string;
    nombre: string;
    disponible_desde: string | null;
    disponible_hasta: string | null;
    periodicidad: number | null;
  }>(`SELECT id, nombre, disponible_desde, disponible_hasta, periodicidad FROM form`);

  const now = new Date();
  const out: { form_id: string; title: string; body: string }[] = [];

  for (const f of forms) {
    const desde = parseInGT(f.disponible_desde);
    const hasta = parseInGT(f.disponible_hasta);
    const per = f.periodicidad ? Number(f.periodicidad) : null;

    if (!desde) continue;
    if (!isWithinWindow(now, desde, hasta)) continue;

    const diffDays = toGtDay(now) - toGtDay(desde);
    if (diffDays < 0) continue;

    // ¿hoy arranca período?
    let isStartToday = false;
    if (per && per > 0) {
      isStartToday = diffDays % per === 0;
    } else {
      // sin periodicidad → sólo el primer día de disponibilidad
      isStartToday = diffDays === 0;
    }
    if (!isStartToday) continue;

    // dedupe por (form, día-de-inicio-de-periodo)
    const periodStartDay =
      per && per > 0 ? toGtDay(desde) + Math.floor(diffDays / per) * per : toGtDay(desde);
    const kvKey = `noti.periodStart.${f.id}.${periodStartDay}`;
    const seen = await db.getAllAsync<{ v: string }>(`SELECT v FROM kv WHERE k = ? LIMIT 1`, [
      kvKey,
    ]);
    if (seen.length) continue; // ya notificado este período

    // guardar marca
    await db.runAsync(`INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)`, [kvKey, now.toISOString()]);

    const firstDay = diffDays === 0;
    const title = "Formulario disponible";
    const body = firstDay
      ? `Hoy empezó a estar disponible el form “${f.nombre}”.`
      : `Hola, recuerda que hay que llenar el form “${f.nombre}”.`;

    out.push({ form_id: f.id, title, body });
  }

  return out;
};

// 🔁 1) Solo calcula las notis (NO escribe a la DB)
export const planAvailabilityNotifications = async (): Promise<
  { form_id: string; title: string; body: string; kvKey: string }[]
> => {
  await ensureMigrated();
  const db = await getDb();

  // helpers GT (UTC-6, sin DST)
  const GT_OFFSET_MS = 6 * 60 * 60 * 1000;
  const isDateOnly = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const parseInGT = (s?: string | null): Date | null => {
    if (!s) return null;
    return isDateOnly(s) ? new Date(`${s}T00:00:00-06:00`) : new Date(s);
  };
  const toGtDay = (d: Date) => Math.floor((d.getTime() - GT_OFFSET_MS) / 86400000);
  const fromGtDay = (day: number) => new Date(day * 86400000 + GT_OFFSET_MS);
  const endOfDayGT = (d: Date) => new Date(fromGtDay(toGtDay(d) + 1).getTime() - 1);
  const isWithinWindow = (now: Date, desde?: Date | null, hasta?: Date | null) => {
    if (desde && now < desde) return false;
    if (hasta && now > endOfDayGT(hasta)) return false;
    return true;
  };

  const forms = await db.getAllAsync<{
    id: string;
    nombre: string;
    disponible_desde: string | null;
    disponible_hasta: string | null;
    periodicidad: number | null;
    nombre_categoria: string | null;
  }>(
    `SELECT f.id, f.nombre, f.disponible_desde, f.disponible_hasta, f.periodicidad, c.nombre AS nombre_categoria
       FROM form f
       LEFT JOIN category c ON f.categoria_id = c.id`
  );

  const now = new Date();
  const out: { form_id: string; title: string; body: string; kvKey: string }[] = [];

  console.log(`Revisando ${forms.length} formularios...`);
  for (const f of forms) {
    const desde = parseInGT(f.disponible_desde);
    const hasta = parseInGT(f.disponible_hasta);
    const per = f.periodicidad ? Number(f.periodicidad) : null;
    if (!desde) continue;
    if (!isWithinWindow(now, desde, hasta)) continue;

    const diffDays = toGtDay(now) - toGtDay(desde);
    if (diffDays < 1) continue;

    // ¿hoy arranca período?
    let isStartToday = false;
    if (per && per > 0) {
      isStartToday = diffDays % per === 1;
    } else {
      // sin periodicidad → solo el primer día
      isStartToday = diffDays === 1;
    }
    if (!isStartToday) continue;

    // clave para dedupe por (form, día de inicio de período)
    const periodStartDay =
      per && per > 0 ? toGtDay(desde) + Math.floor(diffDays / per) * per : toGtDay(desde);
    const kvKey = `noti.periodStart.${f.id}.${periodStartDay}`;

    const firstDay = diffDays === 1;
    const title = "Formulario disponible";
    const body = firstDay
      ? `Hoy empezó a estar disponible el form “${f.nombre}” en la categoría “${f.nombre_categoria ?? "n/a"}”.`
      : `Hola, recuerda que hay que llenar el form “${f.nombre}” en la categoría “${f.nombre_categoria ?? "n/a"}”.`;

    out.push({ form_id: f.id, title, body, kvKey });
  }

  return out;
};

// 🧷 2) Marca “ya enviada” de forma idempotente (si ya existía, devuelve false)
export const tryMarkNotificationSent = async (kvKey: string): Promise<boolean> => {
  await ensureMigrated();
  const db = await getDb();
  const exists = await db.getAllAsync<{ v: string }>(`SELECT v FROM kv WHERE k = ? LIMIT 1`, [
    kvKey,
  ]);
  if (exists.length) return false;
  try {
    await db.runAsync(`INSERT INTO kv (k, v) VALUES (?, ?)`, [kvKey, new Date().toISOString()]);
    return true;
  } catch {
    // si hubo race y otro hilo insertó primero, lo tomamos como NO-enviar
    return false;
  }
};

// Conteo rápido
export const logDbCounts = async () => {
  const db = await getDb();
  const q = async (sql: string) => (await db.getAllAsync<any>(sql))[0]?.n ?? 0;
  const c = await q(`SELECT COUNT(*) n FROM category`);
  const f = await q(`SELECT COUNT(*) n FROM form`);
  const p = await q(`SELECT COUNT(*) n FROM page`);
  const d = await q(`SELECT COUNT(*) n FROM field`);
  console.log("[DB COUNTS] category:", c, "form:", f, "page:", p, "field:", d);
};

export const clearFormsAndCategories = async () => {
  await ensureMigrated();
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM field;`);
    await db.runAsync(`DELETE FROM page;`);
    await db.runAsync(`DELETE FROM form;`);
    await db.runAsync(`DELETE FROM category;`);
  });
};

// Lectura agrupada (con disponibilidad y filtro por defecto)
export const selectFormsGroupedByCategory = async (opts?: { onlyAvailable?: boolean }) => {
  await ensureMigrated();
  const db = await getDb();

  const rows = await db.getAllAsync<any>(`
    SELECT
      c.id               AS categoria_id,
      c.nombre           AS nombre_categoria,
      c.descripcion      AS categoria_descripcion,

      f.id               AS form_id,
      f.nombre           AS form_nombre,
      f.index_version_id AS form_index_version_id,
      f.index_version_fecha AS form_index_version_fecha,

      f.disponible_desde AS form_disponible_desde,
      f.disponible_hasta AS form_disponible_hasta,
      f.periodicidad     AS form_periodicidad,

      p.id               AS page_id,
      p.secuencia        AS page_secuencia,
      p.nombre           AS page_nombre,
      p.descripcion      AS page_descripcion,
      p.version_id       AS page_version_id,
      p.version_fecha    AS page_version_fecha,

      fd.id              AS field_id,
      fd.sequence        AS field_sequence,
      fd.tipo            AS field_tipo,
      fd.clase           AS field_clase,
      fd.nombre_interno  AS field_nombre_interno,
      fd.etiqueta        AS field_etiqueta,
      fd.ayuda           AS field_ayuda,
      fd.config          AS field_config,
      fd.requerido       AS field_requerido
    FROM category c
    LEFT JOIN form  f  ON f.categoria_id = c.id
    LEFT JOIN page  p  ON p.form_id      = f.id
    LEFT JOIN field fd ON fd.page_version_id = p.version_id
    ORDER BY c.nombre, f.nombre, p.secuencia, fd.sequence, fd.id;
  `);

  const lastMap = await getFormLastFilledMap();
  const now = new Date();

  type FormNode = ServerForm;
  const catMap = new Map<
    string,
    { nombre_categoria: string; descripcion: string | null; formularios: FormNode[] }
  >();
  const formMap = new Map<string, FormNode>();
  const pageMap = new Map<string, ServerPage>();

  for (const r of rows) {
    if (!catMap.has(r.categoria_id)) {
      catMap.set(r.categoria_id, {
        nombre_categoria: r.nombre_categoria,
        descripcion: r.categoria_descripcion ?? null,
        formularios: [],
      });
    }
    const cat = catMap.get(r.categoria_id)!;

    if (!r.form_id) continue;

    if (!formMap.has(r.form_id)) {
      const desdeD = r.form_disponible_desde ? parseInGT(r.form_disponible_desde) : null;
      const hastaD = r.form_disponible_hasta ? parseInGT(r.form_disponible_hasta) : null;
      const period = r.form_periodicidad == null ? null : Number(r.form_periodicidad) || null;

      const windowOK = isWithinWindowGT(now, desdeD, hastaD);
      let periodOK = true;
      if (period && period > 0 && desdeD) {
        const start = getPeriodStartGT(desdeD, period, now);
        const lastStr = lastMap[r.form_id] ?? null;
        const last = lastStr ? new Date(lastStr) : null;
        const filledThisPeriod = isFilledInCurrentPeriod(last, start, period);
        periodOK = !filledThisPeriod;
      }
      const disponible = windowOK && periodOK;

      const f: ServerForm = {
        id_formulario: r.form_id,
        nombre: r.form_nombre,
        version_vigente: {
          id_index_version: r.form_index_version_id,
          fecha_creacion: r.form_index_version_fecha,
        },
        periodicidad: period,
        disponibilidad: {
          desde: r.form_disponible_desde ?? null,
          hasta: r.form_disponible_hasta ?? null,
        },
        disponible,
        paginas: [],
      };
      formMap.set(r.form_id, f);
      cat.formularios.push(f);
    }
    const form = formMap.get(r.form_id)!;

    if (r.page_id) {
      const key = r.page_id;
      if (!pageMap.has(key)) {
        const page: ServerPage = {
          id_pagina: r.page_id,
          secuencia: r.page_secuencia ?? null,
          nombre: r.page_nombre,
          descripcion: r.page_descripcion ?? null,
          pagina_version: { id: r.page_version_id, fecha_creacion: r.page_version_fecha },
          campos: [],
        };
        pageMap.set(key, page);
        form.paginas.push(page);
      }
      const page = pageMap.get(key)!;
      if (r.field_id) {
        page.campos.push({
          id_campo: r.field_id,
          sequence: r.field_sequence,
          tipo: r.field_tipo,
          clase: r.field_clase,
          nombre_interno: r.field_nombre_interno,
          etiqueta: r.field_etiqueta ?? null,
          ayuda: r.field_ayuda ?? null,
          config: r.field_config ? JSON.parse(r.field_config) : null,
          requerido: !!r.field_requerido,
        });
      }
    }
  }

  let out = Array.from(catMap.values());
  for (const cg of out) {
    if (opts?.onlyAvailable !== false) {
      cg.formularios = cg.formularios.filter((f) => f.disponible);
    }
    cg.formularios.sort((a, b) => a.nombre.localeCompare(b.nombre));
    for (const f of cg.formularios) {
      f.paginas.sort(
        (a, b) => (a.secuencia ?? 0) - (b.secuencia ?? 0) || a.id_pagina.localeCompare(b.id_pagina)
      );
      for (const p of f.paginas) {
        p.campos.sort((a, b) => a.sequence - b.sequence || a.id_campo.localeCompare(b.id_campo));
      }
    }
  }
  if (opts?.onlyAvailable !== false) {
    out = out.filter((cg) => (cg.formularios?.length ?? 0) > 0);
  }
  return out;
};

export const selectFormFromGroupedById = async (formId: string) => {
  const groups = await selectFormsGroupedByCategory({ onlyAvailable: false });
  for (const g of groups) {
    const f = g.formularios.find((x) => x.id_formulario === formId);
    if (f) return f;
  }
  return null;
};

// ===== Esquema local para DATASETS (por campo) =====
const ensureDatasetsTables = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS local_dataset_field (
      campo_id        TEXT PRIMARY KEY,
      nombre_interno  TEXT NOT NULL,
      etiqueta        TEXT,
      fuente_id       TEXT,
      version         INTEGER,
      columna         TEXT,
      mode            TEXT,
      total_items     INTEGER
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS local_dataset_value (
      campo_id      TEXT NOT NULL,
      key_text      TEXT NOT NULL DEFAULT '',
      label         TEXT NOT NULL,
      valor_raw_json TEXT,
      extras_json    TEXT,
      PRIMARY KEY (campo_id, key_text, label),
      FOREIGN KEY (campo_id) REFERENCES local_dataset_field(campo_id) ON DELETE CASCADE
    )
  `);

  await run(
    `CREATE INDEX IF NOT EXISTS idx_ldv_field_label ON local_dataset_value (campo_id, label COLLATE NOCASE)`
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_ldv_field_key ON local_dataset_value (campo_id, key_text)`
  );
};

export type DatasetTableRow = {
  key: string | null;
  label: string;
  valor_raw: unknown;
  extras: unknown;
};

export type DatasetTable = {
  campo_id: string;
  nombre_interno: string;
  etiqueta: string;
  fuente_id: string | null;
  version: number | null;
  columna: string | null;
  mode: string | null;
  total_items: number;
  rows: DatasetTableRow[];
};

const serializeDatasetValue = (campo_id: string, r: DatasetTableRow) => {
  const key_text = r.key ?? "";
  return [
    campo_id,
    key_text,
    r.label,
    r.valor_raw == null ? null : JSON.stringify(r.valor_raw),
    r.extras == null ? null : JSON.stringify(r.extras),
  ];
};

const rowToDatasetValue = (r: any): DatasetTableRow => ({
  key: r.key_text === "" ? null : r.key_text,
  label: r.label,
  valor_raw: r.valor_raw_json ? JSON.parse(r.valor_raw_json) : null,
  extras: r.extras_json ? JSON.parse(r.extras_json) : null,
});

export const upsertDatasets = async (tables: DatasetTable[]) => {
  if (!tables?.length) return;
  await ensureDatasetsTables();
  const db = await getDb();

  await db.withTransactionAsync(async () => {
    for (const t of tables) {
      await db.runAsync(
        `INSERT INTO local_dataset_field
          (campo_id, nombre_interno, etiqueta, fuente_id, version, columna, mode, total_items)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(campo_id) DO UPDATE SET
           nombre_interno = excluded.nombre_interno,
           etiqueta       = excluded.etiqueta,
           fuente_id      = excluded.fuente_id,
           version        = excluded.version,
           columna        = excluded.columna,
           mode           = excluded.mode,
           total_items    = excluded.total_items`,
        [
          t.campo_id,
          t.nombre_interno,
          t.etiqueta ?? null,
          t.fuente_id ?? null,
          t.version ?? null,
          t.columna ?? null,
          t.mode ?? null,
          Number.isFinite(t.total_items) ? t.total_items : (t.rows?.length ?? 0),
        ]
      );

      await db.runAsync(`DELETE FROM local_dataset_value WHERE campo_id = ?`, [t.campo_id]);

      if (Array.isArray(t.rows) && t.rows.length) {
        const sql = `INSERT INTO local_dataset_value
          (campo_id, key_text, label, valor_raw_json, extras_json)
          VALUES (?, ?, ?, ?, ?)`;
        for (const r of t.rows) {
          const params = serializeDatasetValue(t.campo_id, r);
          await db.runAsync(sql, params);
        }
      }
    }
  });
};

export const clearDatasets = async () => {
  await ensureDatasetsTables();
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM local_dataset_value`);
    await db.runAsync(`DELETE FROM local_dataset_field`);
  });
};

export const selectDatasetTableByFieldId = async (
  campo_id: string
): Promise<DatasetTable | null> => {
  await ensureDatasetsTables();
  const meta = await all<any>(
    `SELECT campo_id, nombre_interno, etiqueta, fuente_id, version, columna, mode, total_items
       FROM local_dataset_field WHERE campo_id = ? LIMIT 1`,
    [campo_id]
  );
  if (!meta.length) return null;

  const rows = await all<any>(
    `SELECT campo_id, key_text, label, valor_raw_json, extras_json
       FROM local_dataset_value
      WHERE campo_id = ?
      ORDER BY label COLLATE NOCASE ASC`,
    [campo_id]
  );

  const m = meta[0];
  return {
    campo_id: m.campo_id,
    nombre_interno: m.nombre_interno,
    etiqueta: m.etiqueta ?? null,
    fuente_id: m.fuente_id ?? null,
    version: m.version == null ? null : Number(m.version),
    columna: m.columna ?? null,
    mode: m.mode ?? null,
    total_items: m.total_items == null ? rows.length : Number(m.total_items),
    rows: rows.map(rowToDatasetValue),
  };
};

export const selectDatasetRowsByFieldId = async (
  campo_id: string,
  opts?: { q?: string; limit?: number; offset?: number }
): Promise<DatasetTableRow[]> => {
  await ensureDatasetsTables();

  const q = (opts?.q ?? "").trim();
  const limit = Math.max(0, Math.floor(opts?.limit ?? 0));
  const offset = Math.max(0, Math.floor(opts?.offset ?? 0));

  const params: any[] = [campo_id];
  let where = `WHERE campo_id = ?`;
  if (q) {
    where += ` AND label LIKE ? COLLATE NOCASE`;
    params.push(`%${q}%`);
  }

  let tail = ` ORDER BY label COLLATE NOCASE ASC`;
  if (limit > 0) {
    tail += ` LIMIT ${limit}`;
    if (offset > 0) tail += ` OFFSET ${offset}`;
  }

  const rows = await all<any>(
    `SELECT key_text, label, valor_raw_json, extras_json
       FROM local_dataset_value
       ${where}
       ${tail}`,
    params
  );
  return rows.map(rowToDatasetValue);
};

export const selectDatasetPairOptions = async (
  campo_id: string,
  opts?: { q?: string; limit?: number; offset?: number }
): Promise<{ value: string; label: string }[]> => {
  const items = await selectDatasetRowsByFieldId(campo_id, opts);
  return items.map((r) => ({ value: (r.key ?? "").toString(), label: r.label }));
};

export const selectDatasetLabelByKey = async (campo_id: string, key: string | null) => {
  await ensureDatasetsTables();
  const key_text = key ?? "";
  const rows = await all<{ label: string }>(
    `SELECT label
       FROM local_dataset_value
      WHERE campo_id = ? AND key_text = ?
      LIMIT 1`,
    [campo_id, key_text]
  );
  return rows.length ? rows[0].label : null;
};

export const selectDatasetByFieldAndColumn = async (
  campo_id: string,
  columna: string | null,
  opts?: { q?: string; limit?: number; offset?: number }
) => {
  await ensureDatasetsTables();
  const meta = await all<{ columna: string | null }>(
    `SELECT columna FROM local_dataset_field WHERE campo_id = ? LIMIT 1`,
    [campo_id]
  );
  if (!meta.length) return [];
  const col = meta[0].columna ?? null;
  if ((col ?? null) !== (columna ?? null)) return [];
  return selectDatasetRowsByFieldId(campo_id, opts);
};

// API pública
export const DB = {
  run,
  all,
  ensureMigrated,
  // snapshot autoritativo
  replaceFormsSnapshot,
  // upsert (sin podar) para otros usos
  upsertGroupedForms,
  // lecturas
  selectFormsGroupedByCategory,
  selectFormFromGroupedById,
  logDbCounts,
  clearFormsAndCategories,

  // grupos
  upsertGroup,
  upsertGroups,
  selectGroups,
  selectGroupById,

  // datasets
  upsertDatasets,
  selectDatasetTableByFieldId,
  selectDatasetRowsByFieldId,
  selectDatasetPairOptions,
  selectDatasetLabelByKey,
  selectDatasetByFieldAndColumn,

  // uso local
  setFormLastFilled,
  getFormLastFilledMap,
};
