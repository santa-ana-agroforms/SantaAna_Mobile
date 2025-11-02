// src/api/datasets.ts
import { getAccessToken, getApiBase, makeClient } from "@/api/client";
import { clearDatasets, DB } from "@/db/sqlite";
import axios from "axios";

// Tipos alineados al backend
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

// ----------- HTTP -----------
const authHeaders = async () => {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchAllDatasets = async (): Promise<DatasetTable[]> => {
  const api = await makeClient();
  const url = `/forms/datasets`;
  const { data } = await api.get<DatasetTable[]>(url);
  return data ?? [];
};

export const fetchDatasetsByForm = async (
  formId: string,
  opts?: { notFoundWhenEmpty?: boolean }
) => {
  const base = await getApiBase();
  const headers = await authHeaders();
  const p = new URLSearchParams();
  if (opts?.notFoundWhenEmpty) p.set("notFoundWhenEmpty", "true");
  const url = `${base}/forms/${encodeURIComponent(formId)}/datasets${p.toString() ? `?${p}` : ""}`;
  const { data } = await axios.get<DatasetTable[]>(url, { headers });
  return data ?? [];
};

// ----------- Sincronización local -----------
/**
 * Descarga TODOS los datasets visibles y los guarda en SQLite (reemplazo por campo).
 */
export const syncAllDatasets = async () => {
  const tables = await fetchAllDatasets();
  await clearDatasets();
  if (tables.length) {
    await DB.upsertDatasets(tables);
  }
  return tables.length;
};

/**
 * Descarga datasets de UN formulario y los guarda en SQLite (reemplazo por campo).
 */
export const syncDatasetsByForm = async (formId: string) => {
  const tables = await fetchDatasetsByForm(formId);
  if (tables.length) {
    await DB.upsertDatasets(tables);
  }
  return tables.length;
};

// ----------- Lecturas locales (re-export conveniencia) -----------
export const getDatasetTableLocal = (campo_id: string) => DB.selectDatasetTableByFieldId(campo_id);

export const getDatasetRowsLocal = (
  campo_id: string,
  opts?: { q?: string; limit?: number; offset?: number }
) => DB.selectDatasetRowsByFieldId(campo_id, opts);

export const getDatasetOptionsLocal = (
  campo_id: string,
  opts?: { q?: string; limit?: number; offset?: number }
) => DB.selectDatasetPairOptions(campo_id, opts);

export const getDatasetLabelLocal = (campo_id: string, key: string | null) =>
  DB.selectDatasetLabelByKey(campo_id, key);

export const getDatasetByFieldAndColumnLocal = (
  campo_id: string,
  columna: string | null,
  opts?: { q?: string; limit?: number; offset?: number }
) => DB.selectDatasetByFieldAndColumn(campo_id, columna, opts);
