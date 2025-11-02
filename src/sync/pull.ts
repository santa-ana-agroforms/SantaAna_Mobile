import { makeClient } from "@/api/client";
import { DB } from "@/db/sqlite";
import type { AuthUser, FormTree } from "@/types";

const pullUserAndForms = async (user: AuthUser) => {
  await DB.ensureMigrated(); // <<< IMPORTANTE

  const api = await makeClient();

  // Guardar usuario/roles
  await DB.run(`DELETE FROM user`);
  await DB.run(`DELETE FROM user_role WHERE nombre_de_usuario = ?`, [user.nombre_de_usuario]);
  await DB.run(`INSERT OR REPLACE INTO user (nombre, nombre_de_usuario) VALUES (?, ?)`, [
    user.nombre,
    user.nombre_de_usuario,
  ]);
  for (const r of user.roles) {
    await DB.run(
      `INSERT OR REPLACE INTO user_role (nombre_de_usuario, rol_id, rol_nombre) VALUES (?, ?, ?)`,
      [user.nombre_de_usuario, r.id, r.nombre]
    );
  }

  // Formularios visibles
  const { data } = await api.get<FormTree[]>(`/forms/tree`);

  const db = await (
    await import("expo-sqlite")
  ).openDatabaseAsync("forms.db", { useNewConnection: true });
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM form`);
    await db.runAsync(`DELETE FROM page`);
    await db.runAsync(`DELETE FROM field`);

    for (const form of data) {
      await db.runAsync(
        `INSERT OR REPLACE INTO form (id, nombre, index_version_id, index_version_fecha) VALUES (?, ?, ?, ?)`,
        [
          form.id_formulario,
          form.nombre,
          form.version_vigente.id_index_version,
          form.version_vigente.fecha_creacion,
        ]
      );

      for (const p of form.paginas) {
        await db.runAsync(
          `INSERT OR REPLACE INTO page (id, form_id, secuencia, nombre, descripcion, version_id, version_fecha)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            p.id,
            form.id_formulario,
            p.secuencia ?? 0,
            p.nombre,
            p.descripcion ?? null,
            p.version_id,
            p.version_fecha,
          ]
        );

        for (const f of p.campos) {
          await db.runAsync(
            `INSERT OR REPLACE INTO field
             (id, page_version_id, sequence, tipo, clase, nombre_interno, etiqueta, ayuda, config, requerido)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              f.id,
              p.version_id,
              f.sequence,
              f.tipo,
              f.clase,
              f.nombre_interno,
              f.etiqueta ?? null,
              f.ayuda ?? null,
              f.config ? JSON.stringify(f.config) : null,
              typeof f.requerido === "boolean" ? (f.requerido ? 1 : 0) : (f.requerido ?? 0),
            ]
          );
        }
      }
    }
  });
};

export { pullUserAndForms };
