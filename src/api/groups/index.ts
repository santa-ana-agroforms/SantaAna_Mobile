// Cliente HTTP (igual que en forms/index.ts)
import { makeClient } from "../client";
// DB local (igual que en forms/index.ts)
import { clearGroupById, DB } from "@/db/sqlite";

import { isOnline } from "@/utils/network";
import type { GroupTree } from "./types";

// -------------------------------
// Rutas remotas (Nest /groups)
// -------------------------------

// GET /groups → lista de grupos con sus campos
export const getGroupsRemote = async (opts?: { signal?: AbortSignal }): Promise<GroupTree[]> => {
  const api = await makeClient();
  const { data } = await api.get<GroupTree[]>("/groups", {
    signal: opts?.signal,
  });
  console.log("Fetched groups from remote:", data);
  return data ?? [];
};

// GET /groups/:id → un grupo con sus campos
export const getGroupByIdRemote = async (
  id_grupo: string,
  opts?: {
    signal?: AbortSignal;
  }
): Promise<GroupTree | null> => {
  const api = await makeClient();
  const { data } = await api.get<GroupTree>(`/groups/${id_grupo}`, {
    signal: opts?.signal,
  });
  return data ?? null;
};

// -------------------------------
// Cache local (SQLite)
// -------------------------------

// Guarda múltiples grupos en SQLite (replace de campos)
export const saveGroupsLocal = async (groups: GroupTree[]) => {
  await DB.upsertGroups(groups);
};

// Guarda un grupo (replace de campos)
export const saveGroupLocal = async (group: GroupTree) => {
  await DB.upsertGroup(group);
};

// Lee todos los grupos desde SQLite
export const getGroupsLocal = async (): Promise<GroupTree[]> => {
  return DB.selectGroups();
};

// Lee un grupo por id desde SQLite
export const getGroupByIdLocal = async (id_grupo: string): Promise<GroupTree | null> => {
  return DB.selectGroupById(id_grupo);
};

// -------------------------------------------
// Conveniencias: pull + cache, y get-or-fetch
// -------------------------------------------

export const pullAndCacheGroups = async (opts?: { signal?: AbortSignal }) => {
  // Verificar si hay internat antes de llamar a getGroupsRemote?
  console.log("\n[groups/pullAndCache] checking online status...");
  if (!(await isOnline())) {
    console.warn("No hay conexión a Internet");
    return [];
  }
  console.log("\n[groups/pullAndCache] pulling groups from server...");
  const remote = await getGroupsRemote(opts);
  console.log("\n[groups/pullAndCache] remote groups:", remote);
  const groups = await getGroupsLocal();

  // verificar cuales ya no están en el server y borrarlos
  const remoteIds = new Set(remote.map((g) => g.id_grupo));
  for (const g of groups) {
    if (!remoteIds.has(g.id_grupo)) {
      await clearGroupById(g.id_grupo);
    }
  }
  console.log("Pulled groups from server:", remote);
  await saveGroupsLocal(remote);
  return remote;
};

export const pullAndCacheGroupById = async (id_grupo: string, opts?: { signal?: AbortSignal }) => {
  const remote = await getGroupByIdRemote(id_grupo, opts);
  if (remote) await saveGroupLocal(remote);
  return remote;
};

// Primero intenta local; si no existe, va al server y cachea
export const getGroupOrFetch = async (id_grupo: string) => {
  console.log(`Getting group ${id_grupo} from local or remote`);
  const local = await getGroupByIdLocal(id_grupo);
  console.log("Local group:", local);
  if (local) return local;
  return pullAndCacheGroupById(id_grupo);
};
