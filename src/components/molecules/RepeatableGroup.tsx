// RepeatableGroup.tsx
import type { Campo } from "@/screens/FormPage";
import { colors } from "@/theme/tokens";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";

type Frame = { width: number; height: number };
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

type ReduxProps = {
  sessionId: string;
  pageIndex: number;
  idGrupo: string;
  nombreInternoGrupo: string;
};

type Props = {
  title?: string;
  subtitle?: string;
  fieldsTemplate: Campo[]; // 👈 Campo completo
  entries: Record<string, any>[];
  onChange?: (next: Record<string, any>[]) => void;
  reduxProps?: ReduxProps;
  bindReduxHandlers?: (set: {
    addRow: () => void;
    removeRow: (rowIndex: number) => void;
    setRowField: (rowIndex: number, campoInterno: string, value: any) => void;
  }) => void;
  referenceFrame?: Frame;
  contentFrame?: Frame;
  minEntries?: number;
  renderSummary?: (row: Record<string, any>, idx: number) => React.ReactNode;
  children?: (args: {
    campo: Campo; // 👈 vuelve a salir Campo completo
    row: Record<string, any>;
    setField: (name: string, value: any) => void;
  }) => React.ReactNode;
  inlineEditing?: boolean;
  onAddLabel?: string;
};

const RepeatableGroup: React.FC<Props> = ({
  title,
  subtitle,
  fieldsTemplate,
  entries,
  onChange,
  bindReduxHandlers,
  referenceFrame,
  minEntries = 0,
  renderSummary,
  children,
  inlineEditing = true,
  onAddLabel = "Agregar",
}) => {
  const layoutAnim = LinearTransition.springify().damping(18);
  const minSide = Math.min(referenceFrame?.width ?? 360, referenceFrame?.height ?? 640);

  // medidas sencillas
  const gap = clamp(minSide * 0.015, 8, 18);
  const cardRadius = clamp(minSide * 0.016, 8, 12);
  const cardPad = clamp(minSide * 0.016, 10, 16);
  const touch = Math.max(44, clamp(minSide * 0.11, 40, 48));

  // redux handlers (inyectados externamente)
  const [h, setH] = useState<{
    addRow?: () => void;
    removeRow?: (rowIndex: number) => void;
    setRowField?: (rowIndex: number, campoInterno: string, value: any) => void;
  }>({});
  React.useEffect(() => {
    bindReduxHandlers?.(setH);
  }, [bindReduxHandlers]);

  const [open, setOpen] = useState<number | null>(null);

  const addRow = useCallback(() => {
    const base: Record<string, any> = {};
    for (const c of fieldsTemplate) base[c.nombre_interno] = "";
    if (h.addRow && h.setRowField) {
      const idx = entries.length;
      h.addRow();
      for (const [k, v] of Object.entries(base)) h.setRowField(idx, k, v);
      setOpen(idx);
    } else if (onChange) {
      const idx = entries.length;
      onChange([...entries, base]);
      setOpen(idx);
    }
  }, [entries.length, fieldsTemplate, h.addRow, h.setRowField, onChange]);

  const removeRow = useCallback(
    (idx: number) => {
      if (entries.length <= minEntries) return;
      if (h.removeRow) {
        h.removeRow(idx);
      } else if (onChange) {
        const next = entries.slice();
        next.splice(idx, 1);
        onChange(next);
      }
      setOpen((cur) => (cur === idx ? null : cur != null && cur > idx ? cur - 1 : cur));
    },
    [entries, minEntries, h.removeRow, onChange]
  );

  const setField = useCallback(
    (idx: number, name: string, value: any) => {
      if (h.setRowField) {
        h.setRowField(idx, name, value);
      } else if (onChange) {
        const next = entries.map((r, i) => (i === idx ? { ...r, [name]: value } : r));
        onChange(next);
      }
    },
    [h.setRowField, onChange, entries]
  );

  const templateSorted = useMemo(
    () =>
      [...fieldsTemplate].sort(
        (a, b) =>
          (a.sequence ?? 0) - (b.sequence ?? 0) ||
          String(a.id_campo ?? "").localeCompare(String(b.id_campo ?? ""))
      ),
    [fieldsTemplate]
  );

  return (
    <View style={{ gap }}>
      {(title || subtitle) && (
        <View style={{ gap: 4 }}>
          {!!title && <Text style={{ fontWeight: "800", fontSize: 16 }}>{title}</Text>}
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
              <Text style={{ color: "white", fontWeight: "800" }}>{onAddLabel}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {entries.map((row, idx) => {
        const isOpen = inlineEditing && open === idx;
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
            {/* header fila */}
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
                {renderSummary ? (
                  renderSummary(row, idx)
                ) : (
                  <Text style={{ fontWeight: "700" }}>
                    {(Object.values(row).find(
                      (v) => typeof v === "string" && v.trim()
                    ) as string) ?? `#${idx + 1}`}
                  </Text>
                )}
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

            {/* contenido */}
            {isOpen && children && (
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: cardPad }}>
                {templateSorted.map((campo) => (
                  <View key={campo.id_campo ?? campo.nombre_interno} style={{ marginBottom: 10 }}>
                    {children({
                      campo, // 👈 Campo completo
                      row,
                      setField: (name, value) => setField(idx, name, value),
                    })}
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
};

export default RepeatableGroup;
