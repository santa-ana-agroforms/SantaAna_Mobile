// src/lib/preload-cache.ts
// src/app/forms/helpers/preload.ts
import { DB } from "@/db/sqlite";

type Key = string;
const mem = new Map<Key, unknown>();

export const setPreload = <T>(key: Key, value: T) => {
  mem.set(key, value as unknown);
};

export const takePreload = <T>(key: Key): T | undefined => {
  const v = mem.get(key) as T | undefined;
  if (v !== undefined) mem.delete(key); // úsalo una vez
  return v;
};

const pickGroupIdFromConfig = (cfg: any): string | null => {
  if (!cfg) return null;
  return (
    (
      cfg.id_group ??
      cfg.id_grupo ??
      cfg.groupId ??
      cfg.group_id ??
      cfg.idGroup ??
      cfg.group?.id ??
      null
    )?.toString() ?? null
  );
};

export const preloadFormScreenAndData = async (formId: string, versionId: string) => {
  // 1) Precarga de módulos (bundle)
  try {
    await Promise.all([
      import("app/form/[formId]"), // ⬅️ ruta real
      import("@/screens/FormPage"),
    ]);
  } catch {}

  // 2) Calentar DB/JSI con una consulta baratísima
  try {
    await DB.logDbCounts(); // o una SELECT LIMIT 1 muy simple
  } catch {}

  // 3) Leer el formulario + grupos
  const form = await DB.selectFormFromGroupedById(formId);
  if (!form) return;

  const groupIds = new Set<string>();
  for (const p of form.paginas ?? []) {
    for (const f of p.campos ?? []) {
      const gid = pickGroupIdFromConfig(f.config);
      if (gid) groupIds.add(gid);
    }
  }

  const groups = await Promise.all(
    Array.from(groupIds).map(async (gid) => {
      try {
        return await DB.selectGroupById(gid);
      } catch {
        return null;
      }
    })
  );

  // 4) Sube a cache con clave estable
  setPreload(`form:${formId}:${versionId}`, { form, groups: groups.filter(Boolean) });
};
