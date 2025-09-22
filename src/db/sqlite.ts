// src/db/sqlite.ts
import * as SQLite from "expo-sqlite";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
async function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("forms.db");
    const db = await dbPromise;
    await db.execAsync("PRAGMA foreign_keys = ON;");
    await db.execAsync("PRAGMA journal_mode = WAL;");
  }
  return dbPromise!;
}

// Helpers base
export async function run(sql: string, params: any[] = []) {
  const db = await getDb();
  return db.runAsync(sql, params);
}
export async function all<T = any>(sql: string, params: any[] = []) {
  const db = await getDb();
  return db.getAllAsync<T>(sql, params);
}

// --- Migraciones persistentes con PRAGMA user_version ---
let migrated = false;
export async function ensureMigrated() {
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
}

// ---------------------------------------------
// Opcional: utilidades de sincronización offline
// ---------------------------------------------

// Crea un id estable a partir del nombre de categoría cuando la API no trae id.
// Si tu backend empieza a enviar categoria_id, reemplaza el uso de esta función por el id real.
function slugFromCategoryName(name?: string | null) {
  if (!name || !name.trim()) return "__SIN_CATEGORIA__";
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

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
export async function upsertGroupedForms(groups: ServerCategoryGroup[]) {
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
}

// Lee desde SQLite con el MISMO shape agrupado por categoría que entrega el backend
export async function selectFormsGroupedByCategory(): Promise<ServerCategoryGroup[]> {
  await ensureMigrated();
  const db = await getDb();

  // Traer todo en un solo shot
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
    JOIN form f ON f.categoria_id = c.id
    JOIN page p ON p.form_id = f.id
    LEFT JOIN field fd ON fd.page_version_id = p.version_id
    ORDER BY c.nombre, f.nombre, p.secuencia, fd.sequence, fd.id;
  `);

  // Armar shape agrupado
  const catMap = new Map<string, ServerCategoryGroup>();
  const formMap = new Map<string, ServerForm>();
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

    if (!pageMap.has(r.page_id)) {
      const page: ServerPage = {
        id_pagina: r.page_id,
        secuencia: r.page_secuencia ?? null,
        nombre: r.page_nombre,
        descripcion: r.page_descripcion ?? null,
        pagina_version: {
          id: r.page_version_id,
          fecha_creacion: r.page_version_fecha,
        },
        campos: [],
      };
      pageMap.set(r.page_id, page);
      form.paginas.push(page);
    }
    const page = pageMap.get(r.page_id)!;

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

  // Orden final coherente por si alguna inserción vino desordenada
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
}

export async function selectFormFromGroupedById(formId: string) {
  const groups = await selectFormsGroupedByCategory();
  for (const g of groups) {
    const f = g.formularios.find((x) => x.id_formulario === formId);
    if (f) return f; // trae paginas y campos listos
  }
  return null;
}

// API pública mínima anterior (por compatibilidad)
export const DB = {
  run,
  all,
  ensureMigrated,
  upsertGroupedForms,
  selectFormsGroupedByCategory,
  selectFormFromGroupedById,
};
