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
    // Leer versión actual
    const uvRows = await db.getAllAsync<{ user_version: number }>("PRAGMA user_version;");
    let ver = (uvRows?.[0]?.user_version ?? 0) | 0;

    // v1: esquema original
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

    // v2: categorías + FK lógico (índice) + columna en form
    if (ver < 2) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS category (
          id TEXT PRIMARY KEY,
          nombre TEXT NOT NULL,
          descripcion TEXT
        );
      `);
      // Agregar columna si no existe
      const cols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(form);");
      const hasCategoria = cols.some((c) => c.name === "categoria_id");
      if (!hasCategoria) {
        await db.execAsync(`ALTER TABLE form ADD COLUMN categoria_id TEXT;`);
      }
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_form_categoria_id ON form(categoria_id);`);
      await db.execAsync("PRAGMA user_version = 2;");
      ver = 2;
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

// Serialización de campos del grupo
const serializeGroupField = (f: any) => {
  return [
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
};

const rowToGroupField = (r: any) => {
  return {
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
      secuencia:
        r.pagina_secuencia === null || r.pagina_secuencia === undefined
          ? null
          : Number(r.pagina_secuencia),
    },
  };
};

// Inserta/actualiza UN grupo y reemplaza sus campos
export const upsertGroup = async (group: { id_grupo: string; nombre: string; campos: any[] }) => {
  await ensureGroupsTables();

  await run(
    `INSERT INTO local_groups (id_grupo, nombre) VALUES (?, ?)
     ON CONFLICT(id_grupo) DO UPDATE SET nombre = excluded.nombre`,
    [group.id_grupo, group.nombre]
  );

  // Para simplificar: reemplazamos el set de campos completo
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

// Inserta/actualiza VARIOS grupos
export const upsertGroups = async (
  groups: { id_grupo: string; nombre: string; campos: any[] }[]
) => {
  await ensureGroupsTables();
  for (const g of groups) await upsertGroup(g);
};

// Selecciona todos los grupos (con sus campos)
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

// ---------------------------------------------
// Opcional: utilidades de sincronización offline
// ---------------------------------------------

// Crea un id estable a partir del nombre de categoría cuando la API no trae id.
// Si tu backend empieza a enviar categoria_id, reemplaza el uso de esta función por el id real.
const slugFromCategoryName = (name?: string | null) => {
  if (!name || !name.trim()) return "__SIN_CATEGORIA__";
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
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
  paginas: ServerPage[];
};

type ServerCategoryGroup = {
  nombre_categoria: string;
  descripcion: string | null;
  formularios: ServerForm[];
};

// Inserta/actualiza el payload agrupado por categoría tal como lo devuelve /forms/tree
export const upsertGroupedForms = async (groups: ServerCategoryGroup[]) => {
  await ensureMigrated();
  const db = await getDb();

  await db.withTransactionAsync(async () => {
    for (const cat of groups) {
      const catId = slugFromCategoryName(cat.nombre_categoria); // ⬅️ reemplaza por categoria_id real si lo tienes
      await db.runAsync(
        `INSERT OR REPLACE INTO category (id, nombre, descripcion) VALUES (?, ?, ?);`,
        [catId, cat.nombre_categoria, cat.descripcion ?? null]
      );

      for (const form of cat.formularios) {
        // Limpiar páginas/campos actuales del formulario para evitar basura histórica
        await db.runAsync(
          `DELETE FROM field WHERE page_version_id IN (SELECT version_id FROM page WHERE form_id = ?);`,
          [form.id_formulario]
        );
        await db.runAsync(`DELETE FROM page WHERE form_id = ?;`, [form.id_formulario]);

        // Upsert form con categoría
        await db.runAsync(
          `INSERT OR REPLACE INTO form (id, nombre, index_version_id, index_version_fecha, categoria_id)
           VALUES (?, ?, ?, ?, ?);`,
          [
            form.id_formulario,
            form.nombre,
            form.version_vigente.id_index_version,
            form.version_vigente.fecha_creacion,
            catId,
          ]
        );

        // Insertar páginas y campos
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
  });
};

// src/db/sqlite.ts
export const logDbCounts = async () => {
  const db = await getDb();
  const q = async (sql: string) => (await db.getAllAsync<any>(sql))[0]?.n ?? 0;
  const c = await q(`SELECT COUNT(*) n FROM category`);
  const f = await q(`SELECT COUNT(*) n FROM form`);
  const p = await q(`SELECT COUNT(*) n FROM page`);
  const d = await q(`SELECT COUNT(*) n FROM field`);
  console.log("[DB COUNTS] category:", c, "form:", f, "page:", p, "field:", d);
};

// Lee desde SQLite con el MISMO shape agrupado por categoría que entrega el backend
export const selectFormsGroupedByCategory = async (): Promise<ServerCategoryGroup[]> => {
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

  const catMap = new Map<string, ServerCategoryGroup>();
  const formMap = new Map<string, ServerForm>();
  const pageMap = new Map<string, ServerPage>();

  for (const r of rows) {
    // categoría
    if (!catMap.has(r.categoria_id)) {
      catMap.set(r.categoria_id, {
        nombre_categoria: r.nombre_categoria,
        descripcion: r.categoria_descripcion ?? null,
        formularios: [],
      });
    }
    const cat = catMap.get(r.categoria_id)!;

    // si no hay form_id (categoría sin forms), sigue al siguiente row
    if (!r.form_id) continue;

    // formulario
    if (!formMap.has(r.form_id)) {
      const form: ServerForm = {
        id_formulario: r.form_id,
        nombre: r.form_nombre,
        version_vigente: {
          id_index_version: r.form_index_version_id,
          fecha_creacion: r.form_index_version_fecha,
        },
        paginas: [],
      };
      formMap.set(r.form_id, form);
      cat.formularios.push(form);
    }
    const form = formMap.get(r.form_id)!;

    // puede no haber página (LEFT JOIN) → en ese caso, no push de page
    if (r.page_id) {
      const pageKey = r.page_id;
      if (!pageMap.has(pageKey)) {
        const page: ServerPage = {
          id_pagina: r.page_id,
          secuencia: r.page_secuencia ?? null,
          nombre: r.page_nombre,
          descripcion: r.page_descripcion ?? null,
          pagina_version: { id: r.page_version_id, fecha_creacion: r.page_version_fecha },
          campos: [],
        };
        pageMap.set(pageKey, page);
        form.paginas.push(page);
      }
      const page = pageMap.get(pageKey)!;

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

  const out = Array.from(catMap.values());
  for (const cg of out) {
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
  return out;
};

export const selectFormFromGroupedById = async (formId: string) => {
  const groups = await selectFormsGroupedByCategory();
  for (const g of groups) {
    const f = g.formularios.find((x) => x.id_formulario === formId);
    if (f) return f; // trae paginas y campos listos
  }
  return null;
};

// ===== Esquema local para DATASETS (por campo) =====
const ensureDatasetsTables = async () => {
  // Tabla de metadatos del dataset por campo
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

  // Valores del dataset (opciones). Usamos key_text normalizado para permitir NULL como ''.
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

// Tipos (alineados al backend)
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

// Serializadores
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

// ------------ Descarga/Upsert (reemplazo completo por campo) -------------
/**
 * Reemplaza por completo el contenido local de cada dataset por campo.
 * - Si el campo no existe, lo crea.
 * - Elimina las filas anteriores del campo y carga las nuevas.
 */
export const upsertDatasets = async (tables: DatasetTable[]) => {
  if (!tables?.length) return;
  await ensureDatasetsTables();
  const db = await getDb();

  await db.withTransactionAsync(async () => {
    for (const t of tables) {
      // Upsert metadatos del campo
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

      // Reemplazar filas del dataset para ese campo
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

// ------------- Selects/lecturas -------------
/**
 * Devuelve el dataset completo de un campo (metadatos + filas).
 */
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

/**
 * Busca filas del dataset por campo. Admite:
 * - q: filtro por label (LIKE, case-insensitive)
 * - limit/offset: paginación simple
 */
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

/**
 * Devuelve un arreglo value/label (útil para <Select/>), mapeando key->value.
 */
export const selectDatasetPairOptions = async (
  campo_id: string,
  opts?: { q?: string; limit?: number; offset?: number }
): Promise<{ value: string; label: string }[]> => {
  const items = await selectDatasetRowsByFieldId(campo_id, opts);
  return items.map((r) => ({ value: (r.key ?? "").toString(), label: r.label }));
};

/**
 * Obtiene el label de una key específica del dataset de un campo.
 */
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

/**
 * Variante estricta “por columna”:
 * Útil si querés asegurarte de usar el dataset correcto cuando el campo tiene columna específica.
 * Si la columna no coincide, devuelve [].
 */
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
  if ((col ?? null) !== (columna ?? null)) return []; // no coincide
  return selectDatasetRowsByFieldId(campo_id, opts);
};

// API pública mínima anterior (por compatibilidad)
export const DB = {
  run,
  all,
  ensureMigrated,
  upsertGroupedForms,
  selectFormsGroupedByCategory,
  selectFormFromGroupedById,
  logDbCounts,

  upsertGroup,
  upsertGroups,
  selectGroups,
  selectGroupById,
  upsertDatasets,
  selectDatasetTableByFieldId,
  selectDatasetRowsByFieldId,
  selectDatasetPairOptions,
  selectDatasetLabelByKey,
  selectDatasetByFieldAndColumn,
};
