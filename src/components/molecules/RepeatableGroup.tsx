import React, { useCallback, useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
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

export type GroupRow = Record<string, any>; // UI no añade metadata a Redux

type Frame = { width: number; height: number };

type ReduxProps = {
  sessionId: string;
  pageIndex: number;
  idGrupo: string;
  nombreInternoGrupo: string;
};

type ModalProps = {
  /** "modal" centrado es el default; se deja el enum por si quieres volver a "sheet" más adelante */
  presentation?: "modal";
  title?: string;
};

type Props = {
  title?: string;
  fieldsTemplate: CampoLite[];
  /** Filas actuales (vienen de Redux o del padre en modo controlado) */
  entries: GroupRow[];
  /** Modo controlado (compat): si NO hay reduxProps, se usa onChange */
  onChange?: (next: GroupRow[]) => void;

  /** Modo Redux-first: si se provee, el padre inyectará handlers con bindReduxHandlers */
  reduxProps?: ReduxProps;

  /** Inyección de handlers Redux sin acoplar el componente al store */
  bindReduxHandlers?: (
    set: (h: {
      addRow: () => void;
      removeRow: (rowIndex: number) => void;
      setRowField: (rowIndex: number, campoInterno: string, value: any) => void;
    }) => void
  ) => void;

  /** Opcionales para layout externo (solo para calcular medidas) */
  referenceFrame?: Frame;
  contentFrame?: Frame;

  /** Mínimo permitido; por defecto 0 (ya NO autoinserta filas) */
  minEntries?: number;

  /** Resumen visual por fila (fuera del modal) */
  renderSummary?: (row: GroupRow, idx: number) => React.ReactNode;

  /** Render de campos hijo (se usa dentro del modal) */
  children?: (args: {
    campo: CampoLite;
    row: GroupRow;
    setField: (name: string, value: any) => void;
  }) => React.ReactNode;

  /** Personalización de modal */
  modalProps?: ModalProps;

  /** Id de depuración opcional */
  debugId?: string;
};

/** ===== Helpers visuales ===== */
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** ===== DEBUG ===== */
// const DEBUG = false;
// const makeLogger = (id?: string) => {
//   const prefix = `[RepeatableGroup${id ? `:${id}` : ""}]`;
//   const log = (...args: any[]) => DEBUG && console.log(prefix, ...args);
//   const warn = (...args: any[]) => DEBUG && console.warn(prefix, ...args);
//   const error = (...args: any[]) => DEBUG && console.error(prefix, ...args);
//   return { log, warn, error };
// };

const RepeatableGroup: React.FC<Props> = ({
  title,
  fieldsTemplate,
  entries,
  onChange,
  reduxProps,
  bindReduxHandlers,
  referenceFrame,
  minEntries = 0, // 👈 por defecto 0: no obliga fila inicial
  children,
  renderSummary,
  modalProps,
  // debugId,
}) => {
  // const { log, warn, error } = makeLogger(debugId);

  const layoutAnim = LinearTransition.springify().damping(18);

  const minSide = Math.min(referenceFrame?.width ?? 360, referenceFrame?.height ?? 640);
  const gap = clamp(minSide * 0.016, 10, 22);
  const cardRadius = clamp(minSide * 0.018, 8, 12);
  const cardPad = clamp(minSide * 0.018, 12, 18);
  const smallGap = clamp(minSide * 0.01, 8, 14);
  const sectionTitleSize = clamp(minSide * 0.05, 16, 22);
  const dividerH = clamp(minSide * 0.005, 2, 6);

  const iconFrame = {
    width: (referenceFrame?.height ?? 640) * 0.55,
    height: (referenceFrame?.height ?? 640) * 0.55,
  };
  const iconSize = clamp(minSide * 0.05, 20, 40);

  // === Modo de operación ===
  const isReduxMode = !!reduxProps;

  // === Handlers Redux inyectados (si aplica) ===
  const [reduxHandlers, setReduxHandlers] = useState<{
    addRow?: () => void;
    removeRow?: (rowIndex: number) => void;
    setRowField?: (rowIndex: number, campoInterno: string, value: any) => void;
  }>({});

  useEffect(() => {
    if (bindReduxHandlers) {
      bindReduxHandlers((h) => setReduxHandlers(h));
    }
  }, [bindReduxHandlers]);

  // === Modal state ===
  type ModalMode = "create" | "edit";
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("edit");
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<GroupRow | null>(null); // solo para "create" o si quieres edición diferida

  const openCreate = useCallback(() => {
    // Borrador local vacío basado en template
    const base: GroupRow = {};
    for (const c of fieldsTemplate) base[c.nombre_interno] = "";
    setDraft(base);
    setModalMode("create");
    setModalIndex(null);
    setModalOpen(true);
  }, [fieldsTemplate]);

  const openEdit = useCallback((idx: number) => {
    setModalMode("edit");
    setModalIndex(idx);
    setDraft(null); // edición inmediata (sin borrador); si prefieres diferida, clona aquí
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setModalIndex(null);
    setDraft(null);
  }, []);

  // === Modo controlado helpers ===
  const safeOnChange = useCallback(
    (next: GroupRow[]) => {
      onChange?.(next);
    },
    [onChange]
  );

  // === Acciones UI ===
  const removeOutside = useCallback(
    (idx: number) => {
      if (entries.length <= minEntries) return; // respeta el mínimo si lo configuran > 0
      if (isReduxMode && reduxHandlers.removeRow) {
        reduxHandlers.removeRow(idx);
      } else if (!isReduxMode && onChange) {
        const next = entries.slice();
        next.splice(idx, 1);
        safeOnChange(next);
      }
    },
    [entries, minEntries, isReduxMode, reduxHandlers, onChange, safeOnChange]
  );

  const setFieldImmediate = useCallback(
    (rowIndex: number, campoInterno: string, value: any) => {
      // Edición inmediata (modo edit)
      if (isReduxMode && reduxHandlers.setRowField) {
        reduxHandlers.setRowField(rowIndex, campoInterno, value);
      } else if (!isReduxMode && onChange) {
        const next = entries.map((e, idx) =>
          idx === rowIndex ? { ...e, [campoInterno]: value } : e
        );
        safeOnChange(next);
      }
    },
    [isReduxMode, reduxHandlers, onChange, entries, safeOnChange]
  );

  const setDraftField = useCallback((campoInterno: string, value: any) => {
    setDraft((d) => ({ ...(d ?? {}), [campoInterno]: value }));
  }, []);

  const saveDraft = useCallback(() => {
    if (!draft) return;
    if (isReduxMode && reduxHandlers.addRow && reduxHandlers.setRowField) {
      // Índice futuro = tamaño actual (añadir al final)
      const baseIndex = entries.length;
      reduxHandlers.addRow();
      // propaga valores del borrador
      for (const [k, v] of Object.entries(draft)) {
        reduxHandlers.setRowField(baseIndex, k, v);
      }
    } else if (!isReduxMode && onChange) {
      safeOnChange([...entries, draft]);
    }
    closeModal();
  }, [draft, isReduxMode, reduxHandlers, entries.length, onChange, safeOnChange, closeModal]);

  // === Orden de plantilla estable ===
  const templateSorted = useMemo(() => {
    const sorted = [...fieldsTemplate].sort(
      (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.id_campo.localeCompare(b.id_campo)
    );
    return sorted;
  }, [fieldsTemplate]);

  // === Resumen por defecto (fuera del modal) ===
  const renderRowSummary = (row: GroupRow, idx: number) => {
    if (renderSummary) return renderSummary(row, idx);
    const primaryKey =
      Object.keys(row).find((k) => typeof row[k] === "string" && (row[k] as string)?.trim()) ??
      null;
    const primary = primaryKey ? String(row[primaryKey]) : `#${idx + 1}`;
    const secondary =
      !primaryKey &&
      Object.keys(row)
        .filter((k) => typeof row[k] === "string")
        .slice(0, 2)
        .map((k) => String(row[k]))
        .filter(Boolean)
        .join(" • ");
    return (
      <View style={{ gap: 2 }}>
        <Body weight="bold">{primary}</Body>
        {secondary ? (
          <Body size="xs" color="secondary" numberOfLines={1}>
            {secondary}
          </Body>
        ) : null}
      </View>
    );
  };

  // === UI ===
  return (
    <View style={{ gap }}>
      {/* Header del grupo */}
      {title ? (
        <View
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <Body weight="bold" style={{ fontSize: sectionTitleSize }}>
            {title}
          </Body>
          <Pressable
            onPress={openCreate}
            accessibilityRole="button"
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: colors.primary600,
              borderRadius: 10,
            }}
          >
            <Body style={{ color: "white" }} weight="bold">
              Nuevo
            </Body>
          </Pressable>
        </View>
      ) : (
        <View style={{ alignItems: "flex-end" }}>
          <Pressable
            onPress={openCreate}
            accessibilityRole="button"
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: colors.primary600,
              borderRadius: 10,
            }}
          >
            <Body style={{ color: "white" }} weight="bold">
              Nuevo
            </Body>
          </Pressable>
        </View>
      )}

      {/* Lista de filas (solo resúmenes) */}
      {entries.length === 0 ? <Body color="secondary">No hay registros en este grupo.</Body> : null}

      {entries.map((row, idx) => {
        const canDelete = entries.length > minEntries;
        return (
          <Animated.View key={`row_${idx}`} layout={layoutAnim} entering={FadeIn} exiting={FadeOut}>
            <Pressable
              onPress={() => openEdit(idx)}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: cardRadius,
                backgroundColor: colors.neutral0,
                padding: cardPad,
                marginTop: idx === 0 ? gap * 0.5 : 0,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, paddingRight: smallGap }}>{renderRowSummary(row, idx)}</View>

              <View style={{ flexDirection: "row", gap: smallGap, alignItems: "center" }}>
                {canDelete ? (
                  <IconButton
                    accessibilityLabel="Eliminar"
                    onPress={() => removeOutside(idx)}
                    iconSource={require("../../../assets/images/cerca.png")}
                    frame={iconFrame}
                    iconSize={iconSize}
                    bgColor={colors.danger600}
                    showShadow={false}
                  />
                ) : null}
                <IconButton
                  accessibilityLabel="Editar"
                  onPress={() => openEdit(idx)}
                  iconSource={require("../../../assets/images/lapiz.png")}
                  frame={iconFrame}
                  iconSize={iconSize}
                  bgColor={colors.primary600}
                  showShadow={false}
                />
              </View>
            </Pressable>
          </Animated.View>
        );
      })}

      {/* Divider visual */}
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

      {/* === MODAL CENTRADO === */}
      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: "padding", android: undefined })}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.38)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 720,
              backgroundColor: colors.neutral0,
              borderRadius: 16,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            {/* Header */}
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1 }}>
                <Body weight="bold">
                  {modalProps?.title ??
                    (modalMode === "create" ? "Nuevo registro" : "Editar registro")}
                </Body>
                {modalMode === "edit" && modalIndex != null ? (
                  <Body size="xs" color="secondary">
                    #{modalIndex + 1}
                  </Body>
                ) : null}
              </View>
              <IconButton
                accessibilityLabel="Cerrar"
                onPress={closeModal}
                iconSource={require("../../../assets/images/cerca.png")}
                frame={iconFrame}
                iconSize={iconSize}
                bgColor={colors.textTertiary}
                showShadow={false}
              />
            </View>

            {/* Contenido */}
            <ScrollView
              contentContainerStyle={{ padding: 16, gap: smallGap }}
              keyboardShouldPersistTaps="handled"
            >
              {children ? (
                modalMode === "create" ? (
                  draft ? (
                    <>
                      {templateSorted.map((campo) => (
                        <Animated.View key={campo.id_campo} layout={layoutAnim}>
                          {children({
                            campo,
                            row: draft,
                            setField: (name, value) => setDraftField(name, value),
                          })}
                        </Animated.View>
                      ))}
                    </>
                  ) : null
                ) : modalIndex != null && entries[modalIndex] ? (
                  <>
                    {templateSorted.map((campo) => (
                      <Animated.View key={campo.id_campo} layout={layoutAnim}>
                        {children({
                          campo,
                          row: entries[modalIndex],
                          setField: (name, value) => setFieldImmediate(modalIndex, name, value),
                        })}
                      </Animated.View>
                    ))}
                  </>
                ) : null
              ) : null}
              <View style={{ height: 8 }} />
            </ScrollView>

            {/* Footer */}
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 12,
              }}
            >
              {modalMode === "create" ? (
                <>
                  <Pressable
                    onPress={closeModal}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: colors.textTertiary,
                    }}
                  >
                    <Body style={{ color: "white" }} weight="bold">
                      Cancelar
                    </Body>
                  </Pressable>
                  <Pressable
                    onPress={saveDraft}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: colors.primary600,
                    }}
                  >
                    <Body style={{ color: "white" }} weight="bold">
                      Guardar
                    </Body>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={closeModal}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: colors.primary600,
                  }}
                >
                  <Body style={{ color: "white" }} weight="bold">
                    Listo
                  </Body>
                </Pressable>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default RepeatableGroup;
