// GroupEditor.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";

import { getGroupOrFetch } from "@/api/groups";
import type { GroupField, GroupTree } from "@/api/groups/types";
import FieldRenderer from "@/screens/FieldRenderer";
import type { Campo } from "@/screens/FormPage"; // tu mismo "Campo" que usa FieldRenderer
import { colors } from "@/theme/tokens";

type Frame = { width: number; height: number };
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

type ReduxProps = {
  sessionId: string;
  pageIndex: number;
  idGrupo: string;
  nombreInternoGrupo: string; // nombre del campo padre en tu store
};

type Props = {
  /** id del grupo a cargar (viene del campo padre: campo.config.groupId / id_grupo) */
  groupId: string;

  /** título/ayuda que quieres mostrar (normalmente vienen de campo.etiqueta / campo.ayuda) */
  title: string;
  subtitle?: string;

  /** filas actuales (array de objetos) */
  entries: Record<string, any>[];

  /** modo controlado: si NO pasas reduxProps, se usa onChange */
  onChange?: (nextRows: Record<string, any>[]) => void;

  /** modo redux-first: inyectas handlers con bindReduxHandlers */
  reduxProps?: ReduxProps;
  bindReduxHandlers?: (set: {
    addRow: () => void;
    removeRow: (rowIndex: number) => void;
    setRowField: (rowIndex: number, campoInterno: string, value: any) => void;
  }) => void;

  /** layout */
  referenceFrame?: Frame;
  contentFrame?: Frame;

  /** mínimo de filas permitidas (default 0) */
  minEntries?: number;

  /** índice de página para FieldRenderer */
  pageIndex?: number;
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
  pageIndex,
}) => {
  const layoutAnim = LinearTransition.springify().damping(18);
  const minSide = Math.min(referenceFrame?.width ?? 360, referenceFrame?.height ?? 640);

  // UI dims
  const gap = clamp(minSide * 0.015, 8, 18);
  const cardRadius = clamp(minSide * 0.016, 8, 12);
  const cardPad = clamp(minSide * 0.016, 10, 16);
  const touch = Math.max(44, clamp(minSide * 0.11, 40, 48));

  // carga del grupo
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

  // plantilla: usamos los campos tal cual
  const fieldsTemplate: GroupField[] = useMemo(() => group?.campos ?? [], [group]);

  // redux handlers inyectados (si aplica)
  const [h, setH] = useState<{
    addRow?: () => void;
    removeRow?: (rowIndex: number) => void;
    setRowField?: (rowIndex: number, campoInterno: string, value: any) => void;
  }>({});
  useEffect(() => {
    bindReduxHandlers?.(setH);
  }, [bindReduxHandlers]);

  // estado de acordeón
  const [open, setOpen] = useState<number | null>(entries.length ? 0 : null);

  const isReduxMode = !!reduxProps;

  const addRow = useCallback(() => {
    const base: Record<string, any> = {};
    for (const c of fieldsTemplate) base[c.nombre_interno] = "";
    if (isReduxMode && h.addRow && h.setRowField) {
      const idx = entries.length;
      h.addRow();
      for (const [k, v] of Object.entries(base)) h.setRowField(idx, k, v);
      setOpen(idx);
    } else if (onChange) {
      const idx = entries.length;
      onChange([...entries, base]);
      setOpen(idx);
    }
  }, [entries.length, fieldsTemplate, isReduxMode, h.addRow, h.setRowField, onChange]);

  const removeRow = useCallback(
    (idx: number) => {
      if (entries.length <= minEntries) return;
      if (isReduxMode && h.removeRow) {
        h.removeRow(idx);
      } else if (onChange) {
        const next = entries.slice();
        next.splice(idx, 1);
        onChange(next);
      }
      setOpen((cur) => (cur === idx ? null : cur != null && cur > idx ? cur - 1 : cur));
    },
    [entries, minEntries, isReduxMode, h.removeRow, onChange]
  );

  const setField = useCallback(
    (idx: number, name: string, value: any) => {
      if (isReduxMode && h.setRowField) {
        h.setRowField(idx, name, value);
      } else if (onChange) {
        const next = entries.map((r, i) => (i === idx ? { ...r, [name]: value } : r));
        onChange(next);
      }
    },
    [isReduxMode, h.setRowField, onChange, entries]
  );

  return (
    <View style={{ gap }}>
      {/* Header del grupo */}
      <View style={{ gap: 4 }}>
        <Text style={{ fontWeight: "800", fontSize: 16 }}>{title}</Text>
        {!!subtitle && <Text style={{ color: colors.textSecondary }}>{subtitle}</Text>}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <Text style={{ color: colors.textSecondary }}>
            {entries.length} registro{entries.length === 1 ? "" : "s"}
          </Text>
          <Pressable
            onPress={addRow}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor: colors.primary600,
            }}
          >
            <Text style={{ color: "white", fontWeight: "800" }}>Agregar</Text>
          </Pressable>
        </View>
      </View>

      {/* Estado de red */}
      {loading && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ActivityIndicator size="small" />
          <Text style={{ color: colors.textSecondary }}>Cargando grupo…</Text>
        </View>
      )}
      {!!error && <Text style={{ color: colors.danger600 }}>{error}</Text>}

      {/* Lista de filas */}
      {entries.map((row, idx) => {
        const isOpen = open === idx;
        return (
          <Animated.View
            key={idx}
            layout={layoutAnim}
            entering={FadeIn}
            exiting={FadeOut}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: cardRadius,
              backgroundColor: colors.neutral0,
              overflow: "hidden",
            }}
          >
            {/* header de fila */}
            <View
              style={{
                padding: cardPad,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Pressable onPress={() => setOpen(isOpen ? null : idx)} style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700" }}>
                  {(Object.values(row).find((v) => typeof v === "string" && v.trim()) as string) ??
                    `#${idx + 1}`}
                </Text>
              </Pressable>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => setOpen(isOpen ? null : idx)}
                  style={{
                    width: touch,
                    height: touch,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#F7F7F7",
                  }}
                >
                  <Text style={{ fontWeight: "900" }}>{isOpen ? "▾" : "▸"}</Text>
                </Pressable>

                {entries.length > minEntries && (
                  <Pressable
                    onPress={() => removeRow(idx)}
                    style={{
                      width: touch,
                      height: touch,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#FDECEA",
                    }}
                  >
                    <Text style={{ color: colors.danger600, fontWeight: "900" }}>⨯</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* contenido expandido (renderiza los campos del grupo como plantillas) */}
            {isOpen && (
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  padding: cardPad,
                  gap: 10,
                }}
              >
                {fieldsTemplate.map((f) => (
                  <View key={f.id_campo}>
                    <FieldRenderer
                      campo={f as unknown as Campo} // usa la misma forma que FieldRenderer entiende
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
                  <Pressable
                    onPress={() => setOpen(null)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: "#F3F3F3",
                    }}
                  >
                    <Text style={{ fontWeight: "800", color: colors.textSecondary }}>Listo</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
};

export default GroupEditor;
