// src/components/molecules/RepeatableGroup.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";

import { Body } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import IconButton from "../atoms/IconButton";

/** ===== Tipos esperados por FieldRenderer ===== */
export type CampoLite = {
  id_campo: string;
  nombre_interno: string;
  etiqueta?: string;
  requerido?: boolean;
  sequence?: number;
  tipo?: string;
  clase?: string;
};

export type GroupRow = Record<string, any> & { __id: string };

type Frame = { width: number; height: number };

type Props = {
  title?: string;
  fieldsTemplate: CampoLite[];
  /** Filas planas con __id (controlado por el padre/Redux) */
  entries: GroupRow[];
  /** Devuelve las filas planas (controlado) */
  onChange: (next: GroupRow[]) => void;

  /** Opcionales para layout externo (los usa FieldRenderer) */
  referenceFrame?: Frame;
  contentFrame?: Frame;

  /** Grupo requerido / mínimo de entradas */
  required?: boolean;
  minEntries?: number;

  /** Render personalizado del resumen (si deseas) */
  renderSummary?: (row: GroupRow, idx: number) => React.ReactNode;

  /** Children (protocolo que espera FieldRenderer) */
  children: (args: {
    campo: CampoLite;
    row: GroupRow;
    setField: (name: string, value: any) => void; // ← por nombre_interno
  }) => React.ReactNode;

  /** Activa logs de depuración */
  debugId?: string;
};

/** ===== Helpers visuales ===== */
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** ===== DEBUG ===== */
const DEBUG = true; // ← apágalo cuando termines de depurar
const makeLogger = (id?: string) => {
  const prefix = `[RepeatableGroup${id ? `:${id}` : ""}]`;
  const log = (...args: any[]) => DEBUG && console.log(prefix, ...args);
  const warn = (...args: any[]) => DEBUG && console.warn(prefix, ...args);
  const error = (...args: any[]) => DEBUG && console.error(prefix, ...args);
  return { log, warn, error };
};

/** id estable para filas nuevas */
const genId = () => `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/** crea una fila vacía plana en base al template (por nombre_interno) */
const makeEmptyRowFromTemplate = (tpl: CampoLite[]): GroupRow => {
  const base: GroupRow = { __id: genId(), __draft: true };
  for (const c of tpl) base[c.nombre_interno] = "";
  return base;
};

/** igualdad superficial para evitar renders/ciclos innecesarios */
const shallowEqualRows = (a: GroupRow[], b: GroupRow[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ra = a[i];
    const rb = b[i];
    if (ra.__id !== rb.__id) return false;
    const ka = Object.keys(ra);
    const kb = Object.keys(rb);
    if (ka.length !== kb.length) return false;
    for (const k of ka) {
      if (!Object.is(ra[k], rb[k])) return false;
    }
  }
  return true;
};

const RepeatableGroup: React.FC<Props> = ({
  title,
  fieldsTemplate,
  entries,
  onChange,
  referenceFrame,
  required = false,
  minEntries,
  children,
  debugId,
}) => {
  const { log, warn, error } = makeLogger(debugId);

  /** ===== Render calc helpers ===== */
  const layoutAnim = LinearTransition.springify().damping(18);

  const minSide = Math.min(referenceFrame?.width ?? 360, referenceFrame?.height ?? 640);
  const gap = clamp(minSide * 0.016, 10, 22);
  const boxPad = clamp(minSide * 0.014, 12, 18);
  const smallGap = clamp(minSide * 0.01, 8, 14);
  const dividerH = clamp(minSide * 0.005, 2, 6);

  const addCardPadV = clamp(minSide * 0.018, 12, 18);
  const addCardPadH = clamp(minSide * 0.02, 14, 22);
  const addCardRadius = clamp(minSide * 0.018, 8, 12);
  const addCardBorder = clamp(minSide * 0.004, 1, 2);

  const iconFrame = {
    width: (referenceFrame?.height ?? 640) * 0.55,
    height: (referenceFrame?.height ?? 640) * 0.55,
  };
  const iconSize = clamp(minSide * 0.05, 20, 40);

  const _minEntries = useMemo(
    () => (required ? (minEntries ?? 1) : (minEntries ?? 0)),
    [required, minEntries]
  );

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  /** ===== LOG props in ===== */
  useEffect(() => {
    log("mounted with props:", {
      title,
      required,
      minEntries,
      _minEntries,
      entriesLen: entries.length,
      fieldsTemplateLen: fieldsTemplate.length,
      firstEntry: entries[0],
    });
  }, []); // mount once

  useEffect(() => {
    log("props update:", {
      required,
      _minEntries,
      entriesLen: entries.length,
      fieldsTemplateLen: fieldsTemplate.length,
    });
  }, [required, _minEntries, entries.length, fieldsTemplate.length]);

  /** ===== Auto-init filas para cumplir minEntries ===== */
  useEffect(() => {
    if (fieldsTemplate.length === 0) {
      warn("fieldsTemplate está vacío; no se pueden crear filas iniciales.");
      return;
    }
    if (entries.length < _minEntries) {
      const need = _minEntries - entries.length;
      const additions: GroupRow[] = Array.from({ length: need }, () =>
        makeEmptyRowFromTemplate(fieldsTemplate)
      );
      log("auto-init rows:", { need, additions });
      try {
        onChange([...entries, ...additions]);
      } catch (e) {
        error("onChange() lanzó error durante auto-init:", e);
      }
      // marca como expandidas las nuevas
      setCollapsed((c) => {
        const next = { ...c };
        for (const r of additions) next[r.__id] = false;
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length, _minEntries, fieldsTemplate]);

  /** ===== Sincroniza collapsed con entries ===== */
  useEffect(() => {
    setCollapsed((prev) => {
      const next: Record<string, boolean> = {};
      for (const e of entries) if (prev[e.__id]) next[e.__id] = true;
      return next;
    });
  }, [entries]);

  /** ===== Handlers ===== */
  const safeOnChange = useCallback(
    (next: GroupRow[]) => {
      if (!shallowEqualRows(entries, next)) {
        log("safeOnChange → set entries", { from: entries.length, to: next.length, next });
        onChange(next);
      } else {
        log("safeOnChange → no-op (shallowEqualRows=true)");
      }
    },
    [entries, onChange]
  );

  const addEntry = useCallback(() => {
    if (fieldsTemplate.length === 0) {
      warn("addEntry abortado: fieldsTemplate vacío.");
      return;
    }
    const newRow = makeEmptyRowFromTemplate(fieldsTemplate);
    log("addEntry", newRow);
    safeOnChange([...entries, newRow]);
    setCollapsed((c) => ({ ...c, [newRow.__id]: false }));
  }, [entries, fieldsTemplate, safeOnChange]);

  const removeEntry = useCallback(
    (id: string) => {
      if (required && entries.length <= _minEntries) {
        warn("removeEntry bloqueado por minEntries", { entries: entries.length, _minEntries });
        return;
      }
      log("removeEntry", id);
      const next = entries.filter((e) => e.__id !== id);
      safeOnChange(next);
      setCollapsed((c) => {
        const n = { ...c };
        delete n[id];
        return n;
      });
    },
    [entries, required, _minEntries, safeOnChange]
  );

  const setEntryCollapsed = useCallback((id: string, v: boolean) => {
    log("setEntryCollapsed", { id, v });
    setCollapsed((c) => ({ ...c, [id]: v }));
  }, []);

  /** setField: actualiza un campo por nombre_interno dentro de la fila con __id */
  const setField = useCallback(
    (rowId: string, fieldName: string, value: unknown) => {
      log("setField", { rowId, fieldName, value });
      const next = entries.map((e) =>
        e.__id === rowId ? { ...e, [fieldName]: value, __draft: undefined } : e
      );
      safeOnChange(next);
    },
    [entries, safeOnChange]
  );

  const templateSorted = useMemo(() => {
    const sorted = [...fieldsTemplate].sort(
      (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.id_campo.localeCompare(b.id_campo)
    );
    log("templateSorted len:", sorted.length);
    return sorted;
  }, [fieldsTemplate]);

  /** ===== UI bits ===== */
  const AddCard = (
    <Animated.View layout={layoutAnim} pointerEvents="box-none">
      <Animated.View
        entering={FadeIn.duration(150)}
        style={{
          borderWidth: addCardBorder,
          borderStyle: "dashed",
          borderColor: colors.border,
          borderRadius: addCardRadius,
          paddingVertical: addCardPadV,
          paddingHorizontal: addCardPadH,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FAFAFA",
        }}
      >
        <TouchableOpacity onPress={addEntry} accessibilityRole="button">
          <Body weight="bold" style={{ opacity: 0.9, alignSelf: "center" }}>
            + Agregar otro
          </Body>
          <Body size="xs" color="secondary">
            Añade una nueva instancia de este grupo
          </Body>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );

  /** ===== Render ===== */
  if (fieldsTemplate.length === 0) {
    // Muestra algo visible si no hay template (muy común cuando la API aún no trajo los campos)
    warn("Render abortado: fieldsTemplate vacío (¿API aún cargando?)");
    return (
      <View style={{ gap }}>
        {title ? (
          <Body weight="bold" style={{ fontSize: clamp(minSide * 0.05, 16, 22) }}>
            {title}
          </Body>
        ) : null}
        <Body color="secondary">Este grupo no tiene campos para mostrar.</Body>
      </View>
    );
  }

  return (
    <View style={{ gap }}>
      {title ? (
        <Body weight="bold" style={{ fontSize: clamp(minSide * 0.05, 16, 22) }}>
          {title}
        </Body>
      ) : null}

      {/* Log visual si no hay entries */}
      {entries.length === 0 ? (
        <Body color="secondary">Sin filas aún (minEntries={_minEntries}).</Body>
      ) : null}

      {entries.map((row, idx) => {
        const collapsedNow = !!collapsed[row.__id];
        const canDelete = entries.length > _minEntries; // respeta mínimo
        DEBUG && log("render row", { idx, __id: row.__id, collapsedNow, row });

        return (
          <Animated.View key={row.__id} layout={layoutAnim} pointerEvents="box-none">
            <Animated.View
              layout={layoutAnim}
              entering={FadeIn.duration(120)}
              exiting={FadeOut.duration(100)}
              collapsable={false}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: clamp(minSide * 0.018, 8, 12),
                backgroundColor: colors.neutral0,
                padding: boxPad,
                marginTop: idx === 0 ? gap * 0.5 : 0,
              }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                pointerEvents="box-none"
              >
                <Body weight="bold">#{idx + 1} - versión</Body>
                <View style={{ flexDirection: "row", gap: smallGap, alignItems: "center" }}>
                  {canDelete ? (
                    <IconButton
                      accessibilityLabel="Eliminar"
                      onPress={() => removeEntry(row.__id)}
                      iconSource={require("../../../assets/images/cerca.png")}
                      frame={iconFrame}
                      iconSize={iconSize}
                      bgColor={colors.danger600}
                      showShadow={false}
                    />
                  ) : null}
                  <IconButton
                    accessibilityLabel={collapsedNow ? "Editar" : "Completar"}
                    onPress={() => setEntryCollapsed(row.__id, !collapsedNow)}
                    iconSource={
                      collapsedNow
                        ? require("../../../assets/images/lapiz.png")
                        : require("../../../assets/images/marca-de-verificacion.png")
                    }
                    frame={iconFrame}
                    iconSize={iconSize}
                    bgColor={collapsedNow ? colors.textTertiary : colors.primary600}
                    showShadow={false}
                  />
                </View>
              </View>

              {/* Contenido */}
              <Animated.View layout={layoutAnim} style={{ gap: smallGap }} collapsable={false}>
                {collapsedNow ? null : (
                  <Animated.View
                    key="fields"
                    layout={layoutAnim}
                    entering={FadeIn.duration(120)}
                    exiting={FadeOut.duration(80)}
                    pointerEvents="box-none"
                    style={{ gap: smallGap }}
                  >
                    {templateSorted.map((campo) => {
                      DEBUG &&
                        log("render field in row", {
                          rowId: row.__id,
                          campoId: campo.id_campo,
                          nombre_interno: campo.nombre_interno,
                        });
                      try {
                        return (
                          <Animated.View
                            key={campo.id_campo}
                            layout={layoutAnim}
                            collapsable={false}
                            pointerEvents="box-none"
                          >
                            {children({
                              campo,
                              row,
                              setField: (name, value) => setField(row.__id, name, value),
                            })}
                          </Animated.View>
                        );
                      } catch (e) {
                        error("children renderer lanzó error:", e, {
                          campoId: campo.id_campo,
                          nombre_interno: campo.nombre_interno,
                          rowId: row.__id,
                        });
                        return null;
                      }
                    })}
                  </Animated.View>
                )}
              </Animated.View>
            </Animated.View>
          </Animated.View>
        );
      })}

      {AddCard}

      <Animated.View layout={layoutAnim} pointerEvents="box-none">
        <View
          style={{
            height: dividerH,
            backgroundColor: colors.textTertiary,
            opacity: 0.9,
            alignSelf: "stretch",
          }}
        />
      </Animated.View>
    </View>
  );
};

export default RepeatableGroup;
