// Cliente HTTP (igual que en forms/index.ts)
import { makeClient } from "../client";
// DB local (igual que en forms/index.ts)
import { DB } from "@/db/sqlite";

import type { GroupTree } from "./types";

// -------------------------------
// Rutas remotas (Nest /groups)
// -------------------------------

// GET /groups → lista de grupos con sus campos
export async function getGroupsRemote(opts?: {
  signal?: AbortSignal;
}): Promise<GroupTree[]> {
  const api = await makeClient();
  const { data } = await api.get<GroupTree[]>("/groups", {
    signal: opts?.signal,
  });
  return data ?? [];
}

// GET /groups/:id → un grupo con sus campos
export async function getGroupByIdRemote(
  id_grupo: string,
  opts?: {
    signal?: AbortSignal;
  }
): Promise<GroupTree | null> {
  const api = await makeClient();
  const { data } = await api.get<GroupTree>(`/groups/${id_grupo}`, {
    signal: opts?.signal,
  });
  return data ?? null;
}

// -------------------------------
// Cache local (SQLite)
// -------------------------------

// Guarda múltiples grupos en SQLite (replace de campos)
export async function saveGroupsLocal(groups: GroupTree[]) {
  await DB.upsertGroups(groups);
}

// Guarda un grupo (replace de campos)
export async function saveGroupLocal(group: GroupTree) {
  await DB.upsertGroup(group);
}

// Lee todos los grupos desde SQLite
export async function getGroupsLocal(): Promise<GroupTree[]> {
  return DB.selectGroups();
}

// Lee un grupo por id desde SQLite
export async function getGroupByIdLocal(
  id_grupo: string
): Promise<GroupTree | null> {
  return DB.selectGroupById(id_grupo);
}

// -------------------------------------------
// Conveniencias: pull + cache, y get-or-fetch
// -------------------------------------------

export async function pullAndCacheGroups(opts?: { signal?: AbortSignal }) {
  const remote = await getGroupsRemote(opts);
  await saveGroupsLocal(remote);
  return remote;
}

export async function pullAndCacheGroupById(
  id_grupo: string,
  opts?: { signal?: AbortSignal }
) {
  const remote = await getGroupByIdRemote(id_grupo, opts);
  if (remote) await saveGroupLocal(remote);
  return remote;
}

// Primero intenta local; si no existe, va al server y cachea
export async function getGroupOrFetch(id_grupo: string) {
  const local = await getGroupByIdLocal(id_grupo);
  if (local) return local;
  return pullAndCacheGroupById(id_grupo);
}
