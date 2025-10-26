// GroupEditor.tsx — Diseño compacto, claro y alineado al tema
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";

import { getGroupOrFetch } from "@/api/groups";
import type { GroupField, GroupTree } from "@/api/groups/types";
import FieldRenderer from "@/screens/FieldRenderer";
import type { Campo } from "@/screens/FormPage";
import { colors } from "@/theme/tokens";
import Label from "../atoms/Label";

/* ───────────────────────────────────────────────────────── */
type Frame = { width: number; height: number };
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

type ReduxProps = {
  sessionId: string;
  pageIndex: number;
  idGrupo: string;
  nombreInternoGrupo: string;
};

type Density = "compact" | "comfortable";

type Props = {
  groupId: string;
  title: string;
  subtitle?: string;
  entries: Record<string, any>[];

  onChange?: (nextRows: Record<string, any>[]) => void; // controlado (si NO hay reduxProps)
  reduxProps?: ReduxProps;
  bindReduxHandlers?: (
    set: React.Dispatch<
      React.SetStateAction<{
        addRow?: () => void;
        removeRow?: (rowIndex: number) => void;
        setRowField?: (rowIndex: number, campoInterno: string, value: any) => void;
      }>
    >
  ) => void;

  referenceFrame?: Frame;
  contentFrame?: Frame;

  minEntries?: number;
  maxEntries?: number;

  pageIndex?: number;

  /** Resumen de título (línea principal) */
  getRowSummary?: (row: Record<string, any>, fields: GroupField[], idx: number) => string;

  /** Campos que aparecerán en el resumen mini (debajo del título). Si no se define, se usan 2 requeridos. */
  getKeyFields?: (fields: GroupField[]) => GroupField[];

  readOnly?: boolean;

  /** Densidad visual: compact/comfortable (default compact) */
  density?: Density;
};
/* ───────────────────────────────────────────────────────── */

const countMissingRequired = (row: Record<string, any>, fields: GroupField[]) => {
  let missing = 0;
  for (const f of fields) {
    if (!f.requerido) continue;
    const v = row[f.nombre_interno];
    const empty =
      v === null ||
      v === undefined ||
      (typeof v === "string" && v.trim() === "") ||
      (Array.isArray(v) && v.length === 0);
    if (empty) missing += 1;
  }
  return missing;
};

const StatusPill: React.FC<{ missing: number; minSide: number }> = ({ missing, minSide }) => {
  const ok = missing === 0;
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: minSide * 0.011,
        backgroundColor: ok ? "#E9F5EA" : "#FDEEEE",
        borderWidth: 1,
        borderColor: ok ? "#CFEAD2" : "#F2C1C1",
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          fontWeight: "bold",
          color: ok ? colors.primary600 : colors.danger600,
          fontSize: 11,
          includeFontPadding: false,
        }}
      >
        {ok ? "Completo" : `Faltan ${missing}`}
      </Text>
    </View>
  );
};

const GroupEditor: React.FC<Props> = ({
  groupId,
  title,
  subtitle,
  entries,
  onChange,
  reduxProps,
  bindReduxHandlers,
  referenceFrame,
  contentFrame,
  minEntries = 0,
  maxEntries,
  pageIndex,
  readOnly = false,
  density = "compact",
}) => {
  const minSide = Math.min(referenceFrame?.width ?? 360, referenceFrame?.height ?? 640);

  // Dims coherentes y compactas
  const padMul = density === "compact" ? 0.014 : 0.018;
  const touchMul = density === "compact" ? 0.1 : 0.12;

  const gap = clamp(minSide * 0.013, 6, 14);
  const cardRadius = clamp(minSide * 0.016, 8, 12);
  const cardPad = clamp(minSide * padMul, 10, density === "compact" ? 14 : 18);
  const touch = Math.max(40, clamp(minSide * touchMul, 40, density === "compact" ? 48 : 56));
  const titleSize = density === "compact" ? minSide * 0.055 : minSide * 0.055;

  // Carga plantilla
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<GroupTree | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const g = await getGroupOrFetch(groupId);
        if (!cancelled) setGroup(g);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "No se pudo cargar el grupo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const fieldsTemplate: GroupField[] = useMemo(() => group?.campos ?? [], [group]);

  // Redux handlers
  const [h, setH] = useState<{
    addRow?: () => void;
    removeRow?: (rowIndex: number) => void;
    setRowField?: (rowIndex: number, campoInterno: string, value: any) => void;
  }>({});
  useEffect(() => {
    bindReduxHandlers?.(setH);
  }, [bindReduxHandlers]);

  const isReduxMode = !!reduxProps;
  const canAddMore = maxEntries == null ? true : entries.length < maxEntries;

  const emitChange = useCallback(
    (next: Record<string, any>[]) => {
      if (readOnly) return;
      onChange?.(next);
    },
    [onChange, readOnly]
  );

  // Fila expandida (una a la vez)
  const [open, setOpen] = useState<number | null>(entries.length ? 0 : null);
  useEffect(() => {
    if (entries.length === 0) setOpen(null);
    else if (open != null && open >= entries.length) setOpen(entries.length - 1);
  }, [entries.length]); // eslint-disable-line

  // Acciones
  const addRow = useCallback(() => {
    if (!canAddMore || readOnly) return;
    const base: Record<string, any> = {};
    for (const c of fieldsTemplate) base[c.nombre_interno] = "";

    const idx = entries.length;

    if (isReduxMode && h.addRow && h.setRowField) {
      h.addRow();
      for (const [k, v] of Object.entries(base)) h.setRowField(idx, k, v);
      setOpen(idx);
    } else {
      emitChange([...entries, base]);
      setOpen(idx);
    }
  }, [entries, fieldsTemplate, isReduxMode, h, canAddMore, readOnly, emitChange]);

  const removeRow = useCallback(
    (idx: number) => {
      if (readOnly) return;
      if (entries.length <= minEntries) return;

      if (isReduxMode && h.removeRow) {
        h.removeRow(idx);
      } else {
        const next = entries.slice();
        next.splice(idx, 1);
        emitChange(next);
      }
      setOpen((cur) => (cur === idx ? null : cur != null && cur > idx ? cur - 1 : cur));
    },
    [entries, minEntries, isReduxMode, h, readOnly, emitChange]
  );

  const setField = useCallback(
    (idx: number, name: string, value: any) => {
      if (readOnly) return;
      if (isReduxMode && h.setRowField) {
        h.setRowField(idx, name, value);
      } else {
        const next = entries.map((r, i) => (i === idx ? { ...r, [name]: value } : r));
        emitChange(next);
      }
    },
    [isReduxMode, h, readOnly, emitChange, entries]
  );

  // Estado vacío
  const EmptyState = () => (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: cardRadius,
        backgroundColor: colors.surface,
        padding: cardPad,
        alignItems: "center",
        gap: 4,
      }}
    >
      <Text style={{ fontWeight: "800", color: colors.textSecondary }}>Aún no hay registros</Text>
      <Text style={{ color: colors.textSecondary, textAlign: "center", fontSize: 12 }}>
        Toca “Agregar registro” para crear el primero.
      </Text>
    </View>
  );

  return (
    <View style={{ gap }} pointerEvents="auto">
      {/* Header del grupo */}
      <View style={{ gap: 4 }}>
        <Label
          frame={referenceFrame}
          text={`Grupo de datos: ${title}`}
          help={subtitle ? subtitle : undefined}
        />

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "rgba(45,138,36,0.08)", // verde suave
              borderWidth: 1,
              borderColor: "rgba(45,138,36,0.25)",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: minSide * 0.02,
            }}
            accessibilityRole="text"
            accessibilityLabel={`${entries.length} ${entries.length === 1 ? "registro" : "registros"}`}
          >
            {/* puntito indicador */}
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.primary600,
                marginRight: 6,
              }}
            />

            {/* número en negrita + texto */}
            <Text style={{ color: colors.primary600, fontWeight: "900" }}>{entries.length}</Text>
            <Text style={{ color: colors.textSecondary, marginLeft: 4 }}>
              registro{entries.length === 1 ? "" : "s"}
            </Text>
          </View>

          <TouchableOpacity
            disabled={!canAddMore || readOnly}
            onPress={addRow}
            activeOpacity={0.9}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: minSide * 0.02,
              backgroundColor: canAddMore && !readOnly ? colors.primary600 : "#C9DCCA",
              opacity: canAddMore && !readOnly ? 1 : 0.7,
            }}
            testID="group-add"
          >
            <Text style={{ color: "white", fontWeight: "900", fontSize: 13 }}>
              Agregar registro
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Estado de red */}
      {loading && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ActivityIndicator size="small" />
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Cargando grupo…</Text>
        </View>
      )}
      {!!error && <Text style={{ color: colors.danger600 }}>{error}</Text>}

      {/* Lista */}
      <View style={{ gap }} pointerEvents="auto">
        {entries.length === 0 ? (
          <EmptyState />
        ) : (
          <FlatList
            data={entries}
            scrollEnabled={false}
            keyExtractor={(_r, i) => `row-${i}`}
            ItemSeparatorComponent={() => <View style={{ height: gap }} />}
            contentContainerStyle={{ gap }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: row, index: idx }) => {
              const isOpen = open === idx;
              const missing = countMissingRequired(row, fieldsTemplate);

              return (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: missing ? colors.danger600 : colors.border,
                    borderRadius: cardRadius,
                    backgroundColor: colors.neutral0,
                  }}
                  pointerEvents="auto"
                >
                  {/* Encabezado de tarjeta (título + resumen compacto) */}
                  <View style={{ padding: cardPad, gap: 6 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: "800",
                          color: colors.textTertiary,
                          fontSize: titleSize * 0.8,
                        }}
                        numberOfLines={1}
                      >
                        {`Registro #${idx + 1}`}
                      </Text>
                      <StatusPill missing={missing} minSide={minSide} />
                    </View>
                    {/* Acciones compactas */}
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                      <TouchableOpacity
                        onPress={() => setOpen(isOpen ? null : idx)}
                        activeOpacity={0.9}
                        style={{
                          flex: 1,
                          height: touch,
                          borderRadius: 10,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: colors.primary600,
                        }}
                        testID="row-edit"
                      >
                        <Text style={{ color: "white", fontWeight: "900", fontSize: 13 }}>
                          {isOpen ? "Cerrar" : "Editar"}
                        </Text>
                      </TouchableOpacity>

                      {!readOnly && entries.length > minEntries && (
                        <TouchableOpacity
                          onPress={() => removeRow(idx)}
                          activeOpacity={0.9}
                          style={{
                            paddingHorizontal: 12,
                            height: touch,
                            borderRadius: 10,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "transparent",
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                          testID="row-delete"
                        >
                          <Text
                            style={{ color: colors.danger600, fontWeight: "900", fontSize: 13 }}
                          >
                            Eliminar
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Contenido editable */}
                  {isOpen && (
                    <View
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        padding: cardPad,
                        gap: 8,
                        borderRadius: cardRadius,
                        backgroundColor: colors.neutral0,
                      }}
                      pointerEvents="box-none"
                    >
                      {fieldsTemplate.map((f) => (
                        <View key={`${f.id_campo}-${idx}`} pointerEvents="box-none">
                          <FieldRenderer
                            campo={f as unknown as Campo}
                            referenceFrame={referenceFrame!}
                            contentFrame={contentFrame!}
                            pageIndex={pageIndex}
                            external={{
                              value: row[f.nombre_interno],
                              onChange: (val) => setField(idx, f.nombre_interno, val),
                            }}
                          />
                        </View>
                      ))}

                      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                        <TouchableOpacity
                          onPress={() => setOpen(null)}
                          activeOpacity={0.9}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 9,
                            borderRadius: minSide * 0.02,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: "#F3F3F3",
                          }}
                          testID="row-done"
                        >
                          <Text
                            style={{ fontWeight: "800", color: colors.textSecondary, fontSize: 13 }}
                          >
                            Listo
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            }}
          />
        )}
      </View>
    </View>
  );
};

export default React.memo(GroupEditor);
