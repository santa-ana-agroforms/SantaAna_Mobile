// src/api/forms.ts
import { DB } from "@/db/sqlite";
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

// Retry con pequeño backoff (opcional)
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

/** Devuelve cuántas categorías + formularios guardaste, útil para logs/UX */
export const fetchAndSaveForms = async (
  setLoading?: (v: boolean) => void,
  signal?: AbortSignal
): Promise<{ categories: number; forms: number }> => {
  try {
    setLoading?.(true);
    console.log("[forms/fetchAndSave] iniciando fetch de forms...");
    // Verificar que estea online antes de llamar a este método
    if (!(await isOnline())) {
      console.log("[forms/fetchAndSave] offline, no hago fetch");
      setLoading?.(false);
      return { categories: 0, forms: 0 };
    }
    const groups = await getFormsTreeWithRetry(signal);
    // borrar todo lo que haya en DB antes de insertar lo nuevo
    await DB.clearFormsAndCategories();
    let formsCount = 0;
    for (const g of groups) formsCount += g.formularios?.length ?? 0;

    await DB.upsertGroupedForms(groups); // asegúrate que internamente haga BEGIN/COMMIT
    return { categories: groups.length, forms: formsCount };
  } finally {
    setLoading?.(false);
  }
};

export const getFormsTreePlain = async (): Promise<FormTree[]> => {
  const api = await makeClient();
  const { data } = await api.get<FormTree[]>("/forms/tree/plain");
  return data ?? [];
};
