// src/forms/state/formSessionSlice.ts
import { createAsyncThunk, createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";
import uuid from "react-native-uuid";

import {
  deleteEntry,
  getEntryById,
  listEntriesSummary,
  SavedEntry,
  saveEntry,
  SavePayload,
  updateCursor, // 👈 NUEVO
  type EntrySummary,
} from "@/db/form-entries";
import {
  emptyByField,
  keyOf,
  normalizers,
  validators,
  type FieldConfig,
} from "@/forms/runtime/field-registry";

// ─────────────────────────────────────────────────────────
// Tipos base (reutilizan tu definición actual)
// ─────────────────────────────────────────────────────────
export type Campo = {
  id_campo: string;
  sequence: number;
  tipo: string;
  clase: string;
  nombre_interno: string;
  etiqueta?: string | null;
  ayuda?: string | null;
  config?: FieldConfig;
  requerido?: boolean;
};
export type Pagina = {
  id_pagina: string;
  secuencia?: number | null;
  sequence?: number;
  nombre: string;
  descripcion?: string | null;
  pagina_version: { id: string; fecha_creacion: string };
  campos: Campo[];
};
export type FormJSON = {
  id_formulario: string;
  nombre: string;
  version_vigente: { id_index_version: string; fecha_creacion: string };
  paginas: Pagina[];
};

export type GrupoDefinition = {
  id_grupo: string;
  nombre?: string;
  campos: Campo[];
};

export type PageState = Record<string, any>;
export type FilledState = Record<string, PageState>;
type FormStatus = "pending" | "synced" | "ready_to_submit";

// ─────────────────────────────────────────────────────────
// Estado por sesión de formulario
// ─────────────────────────────────────────────────────────
export type SessionState = {
  sessionId: string;
  form: FormJSON;
  currentPageIndex: number;
  state: FilledState;
  status: FormStatus;
  errors: Record<string, string[]>;
  groups: Record<string, GrupoDefinition>; // cache de definiciones
};

export type FormSessionsState = {
  currentSessionId: string | null;
  sessions: Record<string, SessionState>;
  loading: boolean;
  error: string | null;
  entriesSummary: EntrySummary[];
  isLastPage: boolean;
};

const initialState: FormSessionsState = {
  currentSessionId: null,
  sessions: {},
  loading: false,
  error: null,
  entriesSummary: [],
  isLastPage: false,
};

// ─────────────────────────────────────────────────────────
// Helpers puros (sin efectos)
// ─────────────────────────────────────────────────────────
const pageKey = (p: Pagina, idx: number) =>
  p.id_pagina || `pagina_${p.secuencia ?? p.sequence ?? idx + 1}`;

const bootstrapState = (form: FormJSON, prefilled?: FilledState): FilledState => {
  const out: FilledState = {};
  form.paginas.forEach((p, idx) => {
    const pk = pageKey(p, idx);
    const initial: PageState = {};
    p.campos.forEach((c) => {
      const k = keyOf(c.tipo, c.clase);
      if (!k) return;
      initial[c.nombre_interno] = prefilled?.[pk]?.[c.nombre_interno] ?? emptyByField[k];
    });
    out[pk] = prefilled?.[pk] ?? initial;
  });
  return out;
};

const lookupVarValue = (filled: FilledState, varName: string): number => {
  let val: number | null = null;
  Object.values(filled).forEach((page) => {
    if (Object.prototype.hasOwnProperty.call(page, varName)) {
      const v = page[varName];
      if (typeof v === "number") val = v;
    }
  });
  return val ?? 0;
};

const safeCalc = (operation: string, vars: number[]) => {
  const AVG = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const SUM = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  try {
    const fn = new Function("vars", "AVG", "SUM", `return (${operation});`);
    const out = fn(vars, AVG, SUM);
    return typeof out === "number" && Number.isFinite(out) ? out : null;
  } catch {
    return null;
  }
};

const recomputeAllCalcs = (form: FormJSON, filled: FilledState) => {
  form.paginas.forEach((p, idx) => {
    const pk = pageKey(p, idx);
    p.campos
      .filter((c) => c.tipo?.toLowerCase() === "numerico" && c.clase?.toLowerCase() === "calc")
      .forEach((c) => {
        const conf = (c.config || {}) as { vars?: string[]; operation?: string };
        const vars = (conf.vars || []).map((vn) => lookupVarValue(filled, vn));
        const res = safeCalc(conf.operation || "", vars);
        filled[pk][c.nombre_interno] = res;
      });
  });
};

const isPlainObject = (v: any) => v && typeof v === "object" && !Array.isArray(v);
const rowIsEmptyGeneric = (row: any) => {
  if (row?.__draft) return false;
  if (!isPlainObject(row)) return true;
  for (const k of Object.keys(row)) {
    if (k === "__id") continue; // meta
    const v = row[k];
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (isPlainObject(v) && Object.keys(v).length === 0) continue;
    // boolean false y 0 cuentan como valor
    return false;
  }
  return true;
};
const stripEmptyRows = (rows: any[]) =>
  Array.isArray(rows) ? rows.filter((r) => !rowIsEmptyGeneric(r)) : [];

// ─────────────────────────────────────────────────────────
// Thunks
// ─────────────────────────────────────────────────────────
export const initSession = createAsyncThunk<
  { session: SessionState },
  { form: FormJSON; prefilled?: FilledState; sessionId?: string },
  { rejectValue: string }
>("formSession/init", async ({ form, prefilled, sessionId }, { rejectWithValue }) => {
  try {
    const sid = (sessionId as string) ?? (uuid.v4() as string);
    const filled = bootstrapState(form, prefilled);
    recomputeAllCalcs(form, filled);
    const session: SessionState = {
      sessionId: sid,
      form,
      currentPageIndex: 0,
      state: filled,
      status: "pending",
      errors: {},
      groups: {},
    };
    const payload: SavePayload = {
      form_id: form.id_formulario,
      form_name: form.nombre,
      index_version_id: form.version_vigente.id_index_version,
      filled_at_local: new Date().toISOString(),
      fill_json: filled,
      form_json: form,
      status: "pending",
    };

    // Persist new session immediately
    await saveEntry(sid, payload);
    return { session };
  } catch (e: any) {
    return rejectWithValue(e?.message ?? "No se pudo iniciar la sesión del formulario");
  }
});

export const initSessionFromSaved = createAsyncThunk<
  { session: SessionState },
  { local_id: string },
  { rejectValue: string }
>("formSession/initFromSaved", async ({ local_id }, { rejectWithValue }) => {
  try {
    const saved = await getEntryById(local_id);
    if (!saved) throw new Error("No existe el registro local");
    const form = saved.form_json as FormJSON;
    const prefilled = saved.fill_json as FilledState;
    const sid = local_id; // reutilizamos el mismo id
    const filled = bootstrapState(form, prefilled);
    recomputeAllCalcs(form, filled);

    // NUEVO: reanudar desde página guardada (clamp seguro)
    const maxIdx = Math.max(0, (form.paginas?.length ?? 1) - 1);
    const resumeIndex = Math.max(0, Math.min(maxIdx, Number(saved.cursor_page_index ?? 0)));

    const session: SessionState = {
      sessionId: sid,
      form,
      currentPageIndex: resumeIndex,
      state: filled,
      status: saved.status as FormStatus,
      errors: {},
      groups: {},
    };
    return { session };
  } catch (e: any) {
    return rejectWithValue(e?.message ?? "No se pudo cargar la sesión guardada");
  }
});

export const persistCurrentSession = createAsyncThunk<
  { local_id: string },
  { sessionId: string },
  { state: { formSession: FormSessionsState }; rejectValue: string }
>("formSession/persist", async ({ sessionId }, { getState, rejectWithValue }) => {
  try {
    const st = getState().formSession.sessions[sessionId];
    if (!st) throw new Error("Sesión no encontrada");
    const payload: SavePayload = {
      form_id: st.form.id_formulario,
      form_name: st.form.nombre,
      index_version_id: st.form.version_vigente.id_index_version,
      filled_at_local: new Date().toISOString(),
      fill_json: st.state,
      form_json: st.form,
      status: st.status,
      cursor_page_index: st.currentPageIndex,
    };
    await saveEntry(sessionId, payload);
    return { local_id: sessionId };
  } catch (e: any) {
    return rejectWithValue(e?.message ?? "No se pudo persistir la sesión local");
  }
});

export const fetchEntriesSummary = createAsyncThunk<EntrySummary[], void, { rejectValue: string }>(
  "formSession/fetchEntriesSummary",
  async (_, { rejectWithValue }) => {
    try {
      return await listEntriesSummary();
    } catch (e: any) {
      return rejectWithValue(e?.message ?? "No se pudo listar entradas locales");
    }
  }
);

const fetchGroupDefinition = async (id_grupo: string): Promise<GrupoDefinition> => {
  return { id_grupo, campos: [] };
};

export const ensureGroupLoaded = createAsyncThunk<
  { sessionId: string; def: GrupoDefinition },
  { sessionId: string; id_grupo: string },
  { state: { formSession: FormSessionsState }; rejectValue: string }
>(
  "formSession/ensureGroupLoaded",
  async ({ sessionId, id_grupo }, { getState, rejectWithValue }) => {
    try {
      const sess = getState().formSession.sessions[sessionId];
      if (!sess) throw new Error("Sesión no encontrada");
      if (sess.groups[id_grupo]) {
        return { sessionId, def: sess.groups[id_grupo] };
      }
      const def = await fetchGroupDefinition(id_grupo);
      return { sessionId, def };
    } catch (e: any) {
      return rejectWithValue(e?.message ?? "No se pudo cargar el grupo");
    }
  }
);

export const persistCursorIndex = createAsyncThunk<
  void,
  { sessionId: string },
  { state: { formSession: FormSessionsState }; rejectValue: string }
>("formSession/persistCursor", async ({ sessionId }, { getState, rejectWithValue }) => {
  try {
    const st = getState().formSession.sessions[sessionId];
    if (!st) throw new Error("Sesión no encontrada");
    await updateCursor(sessionId, st.currentPageIndex);
  } catch (e: any) {
    return rejectWithValue(e?.message ?? "No se pudo actualizar el cursor");
  }
});

export const getJSONForm = createAsyncThunk<
  SavedEntry | undefined,
  { sessionId: string },
  { state: { formSession: FormSessionsState }; rejectValue: string }
>("formSession/getJSONForm", async ({ sessionId }, { getState, rejectWithValue }) => {
  const state = getState().formSession;
  const sess = state.sessions[sessionId];
  if (!sess) return rejectWithValue("Sesión no encontrada");
  try {
    const saved = await getEntryById(sessionId);
    return saved ?? undefined;
  } catch (e: any) {
    return rejectWithValue(e?.message ?? "No se pudo obtener el formulario guardado");
  }
});

// ─────────────────────────────────────────────────────────
// Slice
// ─────────────────────────────────────────────────────────
const slice = createSlice({
  name: "formSession",
  initialState,
  reducers: {
    setCurrentSession(state, action: PayloadAction<string | null>) {
      state.currentSessionId = action.payload;
    },
    goToPage(state, action: PayloadAction<{ sessionId: string; index: number }>) {
      const sess = state.sessions[action.payload.sessionId];
      if (!sess) return;
      const i = action.payload.index;
      if (i < 0 || i >= sess.form.paginas.length) return;
      sess.currentPageIndex = i;
      state.isLastPage = sess.currentPageIndex === sess.form.paginas.length - 1;
    },
    nextPage(state, action: PayloadAction<{ sessionId: string }>) {
      const sess = state.sessions[action.payload.sessionId];
      if (!sess) return;
      if (sess.currentPageIndex < sess.form.paginas.length - 1) {
        sess.currentPageIndex += 1;
      }
      state.isLastPage = sess.currentPageIndex === sess.form.paginas.length - 1;
    },
    prevPage(state, action: PayloadAction<{ sessionId: string }>) {
      const sess = state.sessions[action.payload.sessionId];
      if (!sess) return;
      if (sess.currentPageIndex > 0) {
        sess.currentPageIndex -= 1;
      }
      state.isLastPage = sess.currentPageIndex === sess.form.paginas.length - 1;
    },
    setFieldValue(
      state,
      action: PayloadAction<{
        sessionId: string;
        nombreInterno: string;
        value: unknown;
        pageIndex?: number;
      }>
    ) {
      const { sessionId, nombreInterno, value } = action.payload;
      const sess = state.sessions[sessionId];
      if (!sess) return;
      const idx = action.payload.pageIndex ?? sess.currentPageIndex;
      const p = sess.form.paginas[idx];
      const pk = pageKey(p, idx);
      const campo = p.campos.find((c) => c.nombre_interno === nombreInterno);
      console.warn(`[🎒] campo: ${campo?.tipo} =`, campo?.clase);
      if (!campo) return;
      const k = keyOf(campo.tipo, campo.clase);
      if (!k) return;

      const looksLikeGroup = !!(campo.config as any)?.id_grupo || Array.isArray(value);

      let nextVal: any;
      if (looksLikeGroup && Array.isArray(value)) {
        nextVal = value as any[];
      } else {
        nextVal = normalizers[k](value, campo.config);
      }

      if (looksLikeGroup && Array.isArray(nextVal)) {
        const ensured = nextVal.map((r: any, i: number) => {
          const id =
            typeof r?.__id === "string" && r.__id.length
              ? r.__id
              : `${nombreInterno}_${i}_${Math.random().toString(36).slice(2, 8)}`;
          return { __id: id, ...r };
        });
        const clean = stripEmptyRows(ensured);
        (sess.state as any)[pk][nombreInterno] = clean;
      } else {
        (sess.state as any)[pk][nombreInterno] = nextVal;
      }

      const errs = validators[k](
        (sess.state as any)[pk][nombreInterno],
        !!campo.requerido,
        campo.config
      );
      if (errs.length) sess.errors[nombreInterno] = errs;
      else delete sess.errors[nombreInterno];

      recomputeAllCalcs(sess.form, sess.state);
      // Evaluete if complete all obligatory fields in current page
      const pageFields = sess.form.paginas[idx].campos;
      const allFilled = pageFields.every((field) => {
        const value = (sess.state as any)[pk][field.nombre_interno];
        return !!value;
      });

      console.log("All filled for page", idx, ":", allFilled);
      if (allFilled) {
        sess.status = "ready_to_submit";
      } else {
        sess.status = "pending";
      }
    },
    clearField(
      state,
      action: PayloadAction<{ sessionId: string; nombreInterno: string; pageIndex?: number }>
    ) {
      const { sessionId, nombreInterno } = action.payload;
      const sess = state.sessions[sessionId];
      if (!sess) return;
      const idx = action.payload.pageIndex ?? sess.currentPageIndex;
      const p = sess.form.paginas[idx];
      const pk = pageKey(p, idx);
      const campo = p.campos.find((c) => c.nombre_interno === nombreInterno);
      if (!campo) return;
      const k = keyOf(campo.tipo, campo.clase);
      if (!k) return;
      (sess.state as any)[pk][nombreInterno] = emptyByField[k];
      delete sess.errors[nombreInterno];
      recomputeAllCalcs(sess.form, sess.state);
    },
    setStatus(state, action: PayloadAction<{ sessionId: string; status: FormStatus }>) {
      const sess = state.sessions[action.payload.sessionId];
      if (!sess) return;
      sess.status = action.payload.status;
    },
    groupAddRow(
      state,
      action: PayloadAction<{
        sessionId: string;
        nombreInternoGrupo: string;
        id_grupo: string;
        pageIndex?: number;
      }>
    ) {
      const { sessionId, nombreInternoGrupo, id_grupo } = action.payload;
      const sess = state.sessions[sessionId];
      if (!sess) return;
      const idx = action.payload.pageIndex ?? sess.currentPageIndex;
      const p = sess.form.paginas[idx];
      const pk = pageKey(p, idx);

      const k = keyOf("grupo", "group");
      if (!k) return;

      const def = sess.groups[id_grupo] ?? { id_grupo, campos: [] };
      const row: Record<string, any> = {};
      def.campos.forEach((c) => {
        const ck = keyOf(c.tipo, c.clase);
        if (ck) row[c.nombre_interno] = emptyByField[ck];
      });

      const current = (sess.state as any)[pk][nombreInternoGrupo];
      const list = Array.isArray(current) ? current.slice() : [];
      list.push(row);
      (sess.state as any)[pk][nombreInternoGrupo] = list;
    },
    groupRemoveRow(
      state,
      action: PayloadAction<{
        sessionId: string;
        nombreInternoGrupo: string;
        rowIndex: number;
        pageIndex?: number;
      }>
    ) {
      const { sessionId, nombreInternoGrupo, rowIndex } = action.payload;
      const sess = state.sessions[sessionId];
      if (!sess) return;
      const idx = action.payload.pageIndex ?? sess.currentPageIndex;
      const p = sess.form.paginas[idx];
      const pk = pageKey(p, idx);

      const arr = (sess.state as any)[pk][nombreInternoGrupo];
      if (Array.isArray(arr)) {
        arr.splice(rowIndex, 1);
        (sess.state as any)[pk][nombreInternoGrupo] = arr;
      }
    },
    groupSetRowField(
      state,
      action: PayloadAction<{
        sessionId: string;
        nombreInternoGrupo: string;
        rowIndex: number;
        campoInterno: string;
        value: unknown;
        pageIndex?: number;
      }>
    ) {
      const { sessionId, nombreInternoGrupo, rowIndex, campoInterno, value } = action.payload;
      const sess = state.sessions[sessionId];
      if (!sess) return;
      const idx = action.payload.pageIndex ?? sess.currentPageIndex;
      const p = sess.form.paginas[idx];
      const pk = pageKey(p, idx);

      const rows = (sess.state as any)[pk][nombreInternoGrupo];
      if (!Array.isArray(rows) || !rows[rowIndex]) return;
      rows[rowIndex][campoInterno] = value;
      (sess.state as any)[pk][nombreInternoGrupo] = rows;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initSession.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(initSession.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.sessions[payload.session.sessionId] = payload.session;
        state.currentSessionId = payload.session.sessionId;
      })
      .addCase(initSession.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload ?? "Error al iniciar la sesión";
      });

    builder
      .addCase(initSessionFromSaved.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(initSessionFromSaved.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.sessions[payload.session.sessionId] = payload.session;
        state.currentSessionId = payload.session.sessionId;
      })
      .addCase(initSessionFromSaved.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload ?? "Error al cargar la sesión guardada";
      });

    builder
      .addCase(persistCurrentSession.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(persistCurrentSession.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(persistCurrentSession.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload ?? "Error al persistir la sesión";
      });

    builder.addCase(fetchEntriesSummary.fulfilled, (state, { payload }) => {
      state.entriesSummary = payload;
    });

    builder.addCase(ensureGroupLoaded.fulfilled, (state, { payload }) => {
      const sess = state.sessions[payload.sessionId];
      if (!sess) return;
      sess.groups[payload.def.id_grupo] = payload.def;
    });
    builder
      .addCase(deleteLocalEntry.fulfilled, (state, { payload }) => {
        const id = payload.local_id;
        if (state.currentSessionId === id) state.currentSessionId = null;
        delete state.sessions[id];
        state.entriesSummary = (state.entriesSummary ?? []).filter((e) => e.local_id !== id);
      })
      .addCase(deleteLocalEntry.rejected, (state, { payload }) => {
        state.error = payload ?? "Error al eliminar el registro";
      });
  },
});

export const {
  setCurrentSession,
  goToPage,
  nextPage,
  prevPage,
  setFieldValue,
  clearField,
  setStatus,
  groupAddRow,
  groupRemoveRow,
  groupSetRowField,
} = slice.actions;

export default slice.reducer;

// ─────────────────────────────────────────────────────────
// Selectores
// ─────────────────────────────────────────────────────────
const base = (r: { formSession: FormSessionsState }) => r.formSession;
export const selectCurrentSessionId = createSelector(base, (s) => s.currentSessionId);
export const selectSessionById = (sessionId?: string | null) =>
  createSelector(base, (s) => (sessionId ? (s.sessions[sessionId] ?? null) : null));
export const selectCurrentSession = createSelector(base, (s) =>
  s.currentSessionId ? (s.sessions[s.currentSessionId] ?? null) : null
);
export const selectPageState = (sessionId: string, pageIndex?: number) =>
  createSelector(selectSessionById(sessionId), (sess) => {
    if (!sess) return null;
    const idx = pageIndex ?? sess.currentPageIndex;
    const p = sess.form.paginas[idx];
    return sess.state[pageKey(p, idx)];
  });
export const selectFieldValue = (sessionId: string, nombreInterno: string, pageIndex?: number) =>
  createSelector(selectSessionById(sessionId), (sess) => {
    if (!sess) return undefined;
    const idx = pageIndex ?? sess.currentPageIndex;
    const p = sess.form.paginas[idx];
    const pk = pageKey(p, idx);
    return (sess.state as any)[pk]?.[nombreInterno];
  });
export const selectErrors = (sessionId: string) =>
  createSelector(selectSessionById(sessionId), (sess) => sess?.errors ?? {});
export const selectCanGoNext = (sessionId: string) =>
  createSelector(selectSessionById(sessionId), (sess) => {
    if (!sess) return false;
    const idx = sess.currentPageIndex;
    const p = sess.form.paginas[idx];
    const pk = pageKey(p, idx);

    for (const c of p.campos) {
      const k = keyOf(c.tipo, c.clase);

      // Caso especial: grupos requeridos
      const isGroup = !!(c as any)?.config?.id_grupo;
      if (isGroup && c.requerido) {
        const rows = (sess.state as any)[pk][c.nombre_interno];
        const nFilled = Array.isArray(rows)
          ? rows.filter((r: any) => !rowIsEmptyGeneric(r)).length
          : 0;
        if (nFilled < 1) return false;
        continue;
      }

      if (!k) continue;
      if (!c.requerido) continue;

      const val = (sess.state as any)[pk][c.nombre_interno];
      const errs = validators[k](val, true, c.config);
      if (errs.length) return false;
    }
    return true;
  });
type RootState = any;

export const selectIsLastPage =
  (sessionId: string) =>
  (state: RootState): boolean => {
    const sess = state.formSession?.sessions?.[sessionId];
    if (!sess) return false; // si no hay sesión, no estás en la última
    const idx = Number(sess.currentPageIndex ?? 0);
    const total = Number(sess.form?.paginas?.length ?? 0);
    if (total <= 0) return true; // sin páginas => trátalo como última (no bloquees)
    return idx >= total - 1; // última página si idx == total-1
  };

// ─────────────────────────────────────────────────────────
// Selectores adicionales (pegar al final de formSessionSlice.ts)
// ─────────────────────────────────────────────────────────
// const hasValue = (v: unknown): boolean => {
//   if (v === null || v === undefined) return false;
//   if (typeof v === "string") return v.trim().length > 0;
//   if (Array.isArray(v)) return v.length > 0;
//   return true; // números/boolean/objetos simples cuentan
// };

/**
 * Valida TODO el formulario: true solo si todos los campos requeridos de todas
 * las páginas tienen valor válido. (Ignora visibilidad condicional por ahora.)
 */
export const selectCanSendForReview = (sessionId: string) =>
  createSelector(selectSessionById(sessionId), (sess) => {
    if (!sess?.form?.paginas?.length) return false;

    for (let idx = 0; idx < sess.form.paginas.length; idx++) {
      const p = sess.form.paginas[idx];
      const pk = p.id_pagina || `pagina_${p.secuencia ?? p.sequence ?? idx + 1}`;
      const pageVals = (sess.state as any)[pk] ?? {};

      for (const c of p.campos ?? []) {
        const isGroup = !!(c as any)?.config?.id_grupo;

        // Grupos requeridos: al menos 1 fila no vacía
        if (isGroup && c.requerido) {
          const rows = pageVals[c.nombre_interno];
          const nFilled = Array.isArray(rows)
            ? rows.filter((r: any) => !rowIsEmptyGeneric(r)).length
            : 0;
          if (nFilled < 1) return false;
          continue;
        }

        if (!c?.requerido) continue;

        const k = keyOf(c.tipo, c.clase);
        const val = pageVals[c.nombre_interno];

        if (!k) {
          // Sin mapeo: usar fallback simple (el antiguo hasValue)
          const fallbackHasValue = (v: unknown): boolean => {
            if (v === null || v === undefined) return false;
            if (typeof v === "string") return v.trim().length > 0;
            if (Array.isArray(v)) return v.length > 0;
            return true;
          };
          if (!fallbackHasValue(val)) return false;
          continue;
        }

        // Usa el validador real del tipo
        const errs = validators[k](val, true, c.config);
        if (errs.length) return false;
      }
    }
    return true;
  });

export const deleteLocalEntry = createAsyncThunk<
  { local_id: string },
  { local_id: string },
  { state: { formSession: FormSessionsState }; rejectValue: string }
>("formSession/deleteLocalEntry", async ({ local_id }, { rejectWithValue }) => {
  try {
    await deleteEntry(local_id); // ← usa la función nueva
    return { local_id };
  } catch (e: any) {
    return rejectWithValue(e?.message ?? "No se pudo eliminar el registro local");
  }
});
