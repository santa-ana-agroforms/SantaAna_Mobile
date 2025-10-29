// src/api/forms.ts
import { DB, deleteFormById } from "@/db/sqlite";
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

    console.log("[forms/fetchAndSave] online, haciendo fetch...");
    const newForms = await getFormsTreeWithRetry(signal);
    // Obtener los formularios actuales
    const currentForms = await DB.selectFormsGroupedByCategory();

    // Buscar cuales formularios ya no están
    const currentFormIds = new Set<string>();
    for (const cat of currentForms) {
      for (const form of cat.formularios ?? []) {
        if (form.id_formulario) currentFormIds.add(form.id_formulario);
      }
    }

    const newFormIds = new Set<string>();
    for (const cat of newForms) {
      for (const form of cat.formularios ?? []) {
        if (form.id_formulario) newFormIds.add(form.id_formulario);
      }
    }

    // Formularios a borrar = current - new
    for (const id of newFormIds) {
      currentFormIds.delete(id);
    }

    console.log("[forms/fetchAndSave] current form IDs:", currentFormIds);
    for (const id of currentFormIds) {
      await deleteFormById(id);
    }

    console.log("[forms/fetchAndSave] saving fetched forms...");

    let formsCount = 0;
    for (const g of newForms) formsCount += g.formularios?.length ?? 0;

    await DB.upsertGroupedForms(newForms); // asegúrate que internamente haga BEGIN/COMMIT
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
