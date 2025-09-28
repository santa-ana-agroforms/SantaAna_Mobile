// src/api/forms.ts
import { DB } from "@/db/sqlite";
import { makeClient } from "../client";
import { FormCategoryGroup, FormTree } from "./types";

// GET /forms/tree → ahora devuelve grupos por categoría
export const getFormsTree = async (opts?: {
  signal?: AbortSignal;
}): Promise<FormCategoryGroup[]> => {
  const api = await makeClient();
  const { data } = await api.get<FormCategoryGroup[]>("/forms/tree", {
    signal: opts?.signal,
  });
  return data ?? [];
};

// Funcion para obtner los formularios, provee una promesa y un loading
export const fetchAndSaveForms = async (
  setLoading?: (v: boolean) => void,
  signal?: AbortSignal
): Promise<void> => {
  try {
    setLoading?.(true);
    const forms = await getFormsTree({ signal });
    console.log("Fetched forms:", forms);
    console.log("Saving forms to local DB...", forms);
    await DB.upsertGroupedForms(forms);
  } finally {
    setLoading?.(false);
  }
};

export const getFormsTreePlain = async (): Promise<FormTree[]> => {
  const api = await makeClient();
  const { data } = await api.get<FormTree[]>("/forms/tree/plain");
  return data ?? [];
};
