// src/api/forms.ts
import { DB, ServerCategoryGroup } from "@/db/sqlite";
import { isOnline } from "@/utils/network";
import { makeClient } from "../client";
import { FormCategoryGroup, FormTree } from "./types";

export const getFormsTree = async (opts?: {
  signal?: AbortSignal;
}): Promise<FormCategoryGroup[]> => {
  const api = await makeClient();
  const { data } = await api.get<FormCategoryGroup[]>("/forms/tree", { signal: opts?.signal });
  return data ?? [];
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const getFormsTreeWithRetry = async (
  signal?: AbortSignal,
  tries = 2
): Promise<FormCategoryGroup[]> => {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await getFormsTree({ signal });
    } catch (e) {
      lastErr = e;
      if (signal?.aborted) throw e;
      if (i < tries - 1) await wait(400 * (i + 1));
    }
  }
  throw lastErr;
};

/**
 * Sincroniza formularios con un snapshot AUTORITATIVO.
 * - Reemplaza el contenido local para que coincida EXACTO con /forms/tree.
 * - Se hace en UNA transacción para evitar flicker (borrar/insertar visibles).
 * - Persiste disponible_desde / disponible_hasta / periodicidad (local).
 */
export const fetchAndSaveForms = async (
  setLoading?: (v: boolean) => void,
  signal?: AbortSignal
): Promise<{ categories: number; forms: number }> => {
  try {
    setLoading?.(true);
    if (!(await isOnline())) {
      return { categories: 0, forms: 0 };
    }

    const newForms = await getFormsTreeWithRetry(signal);

    // Reemplazo atómico + poda exacta
    await DB.replaceFormsSnapshot(newForms as ServerCategoryGroup[]);

    let formsCount = 0;
    for (const g of newForms) formsCount += g.formularios?.length ?? 0;
    return { categories: newForms.length, forms: formsCount };
  } finally {
    setLoading?.(false);
  }
};

export const getFormsTreePlain = async (): Promise<FormTree[]> => {
  const api = await makeClient();
  const { data } = await api.get<FormTree[]>("/forms/tree/plain");
  return data ?? [];
};
