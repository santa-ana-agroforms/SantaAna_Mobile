import { getEntryById, listEntriesSummary, saveEntry, type EntrySummary } from "@/db/form-entries";
// import react-native-uuid
import uuid from "react-native-uuid";
import { emptyByField, FieldConfig, keyOf, normalizers, validators } from "./field-registry";

// Tipos mínimos según tu JSON de formulario (resumen):
// Basado en el ejemplo que subiste: id_formulario, nombre, version_vigente, paginas[], campos[] con {tipo, clase, nombre_interno, requerido, config...}
// (ejemplo real en tu archivo response_*.json)  :contentReference[oaicite:2]{index=2}
export type Campo = {
  id_campo: string;
  sequence: number;
  tipo: string; // "texto" | "numerico" | "booleano" | "imagen"...
  clase: string; // "string" | "list" | "date" | "number" | "calc" | "boolean" | "firm" | "group"
  nombre_interno: string;
  etiqueta?: string | null; // etiqueta es requerida en FormSession.Campo
  ayuda?: string | null;
  config?: FieldConfig;
  requerido?: boolean;
};

export type Pagina = {
  id_pagina: string;
  secuencia?: number | null;
  sequence?: number; // por si viene con otro nombre
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

// Para grupos: el "schema" del grupo (lista de campos)
export type GrupoDefinition = {
  id_grupo: string;
  nombre?: string;
  campos: Campo[];
};

export type PageState = Record<string, any>; // nombre_interno -> valor
export type FilledState = Record<string, PageState>; // "pagina_<n>" o id_pagina -> PageState

export class FormSession {
  readonly form: FormJSON;
  readonly sessionId: string; // uuid de esta sesión
  private currentPageIndex = 0;
  private state: FilledState = {};
  private status: "pending" | "synced" | "ready_to_submit" = "pending";
  private errors: Record<string, string[]> = {}; // clave campo -> errores
  private groupsCache = new Map<string, GrupoDefinition>(); // id_grupo -> def

  constructor(form: FormJSON, prefilled?: FilledState, sessionId?: string) {
    this.form = form;
    this.sessionId = sessionId ?? uuid.v4();
    if (sessionId) {
      // Recargar de db si viene id
      (async () => {
        const saved = await getEntryById(sessionId);
        if (saved) {
          this.status = saved.status;
          this.bootstrapState(saved.fill_json as FilledState);
        } else {
          this.bootstrapState(prefilled);
        }
      })();
    } else {
      this.bootstrapState(prefilled);
    }
  }

  // Crea estructura vacía por página/campo
  private bootstrapState(prefilled?: FilledState) {
    this.form.paginas.forEach((p, idx) => {
      const pageKey = this.pageKey(p, idx);
      const initial: PageState = {};
      p.campos.forEach((c) => {
        const k = keyOf(c.tipo, c.clase);
        if (!k) return; // desconocido, lo saltamos
        initial[c.nombre_interno] = prefilled?.[pageKey]?.[c.nombre_interno] ?? emptyByField[k];
      });
      this.state[pageKey] = prefilled?.[pageKey] ?? initial;
    });
    // Calcular iniciales para "calc"
    this.recomputeAllCalcs();
  }

  private pageKey(p: Pagina, idx: number) {
    return p.id_pagina || `pagina_${p.secuencia ?? p.sequence ?? idx + 1}`;
  }

  getCurrentPageIndex() {
    return this.currentPageIndex;
  }
  getPageCount() {
    return this.form.paginas.length;
  }

  getPageState(index = this.currentPageIndex): PageState {
    const p = this.form.paginas[index];
    return this.state[this.pageKey(p, index)];
  }

  getAllState(): FilledState {
    return this.state;
  }

  // Obtener valor de campo por nombre interno
  getFieldValue(nombreInterno: string, index = this.currentPageIndex) {
    const p = this.form.paginas[index];
    const pageKey = this.pageKey(p, index);
    return this.state[pageKey]?.[nombreInterno];
  }

  // Setear valor (usa normalizador + validador del diccionario)
  setFieldValue(nombreInterno: string, value: unknown, index = this.currentPageIndex) {
    const p = this.form.paginas[index];
    const pageKey = this.pageKey(p, index);
    const campo = p.campos.find((c) => c.nombre_interno === nombreInterno);
    if (!campo) return;

    const key = keyOf(campo.tipo, campo.clase);
    if (!key) return;

    const norm = normalizers[key](value, campo.config);
    this.state[pageKey][nombreInterno] = norm;

    // validar ese campo
    const errs = validators[key](norm, !!campo.requerido, campo.config);
    if (errs.length) {
      this.errors[nombreInterno] = errs;
    } else {
      delete this.errors[nombreInterno];
    }

    // si hay campos calculados que dependen, recalcular todos (barato para tamaños chicos)
    this.recomputeAllCalcs();
  }

  // Limpiar a valor vacío del diccionario
  clearField(nombreInterno: string, index = this.currentPageIndex) {
    const p = this.form.paginas[index];
    const pageKey = this.pageKey(p, index);
    const campo = p.campos.find((c) => c.nombre_interno === nombreInterno);
    if (!campo) return;
    const key = keyOf(campo.tipo, campo.clase);
    if (!key) return;
    this.state[pageKey][nombreInterno] = emptyByField[key];
    delete this.errors[nombreInterno];
    this.recomputeAllCalcs();
  }

  // --- Grupos (listas repetibles) ---

  // Devuelve definición de grupo desde cache o la busca
  async getGroupOrFetch(id_grupo: string): Promise<GrupoDefinition> {
    if (this.groupsCache.has(id_grupo)) return this.groupsCache.get(id_grupo)!;
    // Aquí podés usar tu client API o SQLite local para poblar:
    // const def = await api.groups.getById(id_grupo)
    const def: GrupoDefinition = {
      id_grupo,
      campos: [], // <- reemplazar con la respuesta real
    };
    this.groupsCache.set(id_grupo, def);
    return def;
  }

  // Agrega una fila al grupo (objeto con valores vacíos según schema del grupo)
  async groupAddRow(nombreInternoGrupo: string, id_grupo: string, index = this.currentPageIndex) {
    const p = this.form.paginas[index];
    const pageKey = this.pageKey(p, index);
    const current = this.state[pageKey][nombreInternoGrupo];
    const key = keyOf("grupo", "group");
    if (!key) return;

    const def = await this.getGroupOrFetch(id_grupo);
    const row: Record<string, any> = {};
    def.campos.forEach((c) => {
      const k = keyOf(c.tipo, c.clase);
      if (k) row[c.nombre_interno] = emptyByField[k];
    });

    const list = normalizers[key](current);
    list.push(row);
    this.state[pageKey][nombreInternoGrupo] = list;
  }

  groupRemoveRow(nombreInternoGrupo: string, rowIndex: number, index = this.currentPageIndex) {
    const p = this.form.paginas[index];
    const pageKey = this.pageKey(p, index);
    const arr = this.state[pageKey][nombreInternoGrupo];
    if (Array.isArray(arr)) {
      arr.splice(rowIndex, 1);
      this.state[pageKey][nombreInternoGrupo] = arr;
    }
  }

  groupSetRowField(
    nombreInternoGrupo: string,
    rowIndex: number,
    campoInterno: string,
    value: unknown,
    id_grupo: string,
    index = this.currentPageIndex
  ) {
    const p = this.form.paginas[index];
    const pageKey = this.pageKey(p, index);
    const rows = this.state[pageKey][nombreInternoGrupo];
    if (!Array.isArray(rows) || !rows[rowIndex]) return;

    // Ideal: validar con el schema real del grupo:
    // const def = await this.getGroupOrFetch(id_grupo)
    rows[rowIndex][campoInterno] = value;
    this.state[pageKey][nombreInternoGrupo] = rows;
  }

  // --- Cálculos ---

  private recomputeAllCalcs() {
    // Construir contexto de variables (opcional): podés mapear con nombres conocidos
    // Aquí haré un helper por campo 'calc' usando su config.vars y operation.
    this.form.paginas.forEach((p, idx) => {
      const pageKey = this.pageKey(p, idx);
      p.campos
        .filter((c) => c.tipo?.toLowerCase() === "numerico" && c.clase?.toLowerCase() === "calc")
        .forEach((c) => {
          const conf = (c.config || {}) as { vars?: string[]; operation?: string };
          const vars = (conf.vars || []).map((vn) => this.lookupVarValue(vn));
          const result = this.safeCalc(conf.operation || "", vars);
          this.state[pageKey][c.nombre_interno] = result;
        });
    });
  }

  private lookupVarValue(varName: string): number {
    // Estrategia simple: buscar en TODO el estado un campo que se llame varName o similar.
    // En tu modelo dijiste que los campos numéricos crean variables; si querés, mapealo explícito.
    let val: number | null = null;
    Object.values(this.state).forEach((page) => {
      if (Object.prototype.hasOwnProperty.call(page, varName)) {
        const v = page[varName];
        if (typeof v === "number") val = v;
      }
    });
    return val ?? 0;
  }

  // Mini-evaluador controlado para operation: soporta "vars[0]*2", "AVG(vars)", "SUM(vars)"
  private safeCalc(operation: string, vars: number[]) {
    const AVG = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const SUM = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

    try {
      // Permitimos una expresión JS con variables locales: vars, AVG, SUM
      // Nota: en RN esto corre local; si querés máxima seguridad, parseá con un evaluador propio.

      const fn = new Function("vars", "AVG", "SUM", `return (${operation});`);
      const out = fn(vars, AVG, SUM);
      return typeof out === "number" && Number.isFinite(out) ? out : null;
    } catch {
      return null;
    }
  }

  // --- Navegación y validación ---

  // ¿Se puede avanzar desde la página actual? (requeridos completos)
  canGoNext(index = this.currentPageIndex): boolean {
    const p = this.form.paginas[index];
    const pageKey = this.pageKey(p, index);
    for (const c of p.campos) {
      if (!c.requerido) continue;
      const key = keyOf(c.tipo, c.clase);
      if (!key) continue;
      const val = this.state[pageKey][c.nombre_interno];
      const errs = validators[key](val, true, c.config);
      if (errs.length) return false;
    }
    return true;
  }

  goToPage(index: number) {
    if (index < 0 || index >= this.getPageCount()) return;
    this.currentPageIndex = index;
  }

  nextPage() {
    if (this.canGoNext(this.currentPageIndex) && this.currentPageIndex < this.getPageCount() - 1) {
      this.currentPageIndex += 1;
    }
  }

  prevPage() {
    if (this.currentPageIndex > 0) this.currentPageIndex -= 1;
  }

  // --- Cierre y persistencia (offline) ---

  async closeAndPersist(): Promise<{ local_id: string }> {
    console.log("Persistiendo sesión de formulario con id local:", this.sessionId);
    const payload = {
      form_id: this.form.id_formulario,
      form_name: this.form.nombre,
      index_version_id: this.form.version_vigente.id_index_version,
      filled_at_local: new Date().toISOString(), // hora local en ISO
      fill_json: this.state,
      form_json: this.form,
      status: this.status,
    };
    await saveEntry(this.sessionId, payload);
    console.log("Sesión persistida:", payload);
    return { local_id: this.sessionId };
  }

  setStatus(newStatus: "pending" | "synced" | "ready_to_submit") {
    this.status = newStatus;
  }

  // Auxiliares públicos
  static async listLocalEntries(): Promise<EntrySummary[]> {
    return listEntriesSummary();
  }

  static async fromSaved(local_id: string): Promise<FormSession | null> {
    const saved = await getEntryById(local_id);
    if (!saved) return null;
    const form = saved.form_json as FormJSON;
    const prefilled = saved.fill_json as FilledState;
    const session = new FormSession(form, prefilled);
    return session;
  }
}
