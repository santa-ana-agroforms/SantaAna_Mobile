// GroupEditor.tsx — SOLO MODAL (bottom sheet) para ver/editar registros
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Modal,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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

  readOnly?: boolean;
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

  const sheetMaxH = Math.round((referenceFrame?.height ?? 640) * 0.7);

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

  // Acciones
  const addRow = useCallback(() => {
    if (!canAddMore || readOnly) return;
    const base: Record<string, any> = {};
    for (const c of fieldsTemplate) base[c.nombre_interno] = "";

    const idx = entries.length;

    if (isReduxMode && h.addRow && h.setRowField) {
      h.addRow();
      for (const [k, v] of Object.entries(base)) h.setRowField(idx, k, v);
      setModalOpenIdx(idx);
    } else {
      emitChange([...entries, base]);
      setModalOpenIdx(idx);
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
      setModalOpenIdx((cur) => (cur === idx ? null : cur != null && cur > idx ? cur - 1 : cur));
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

  // ───────────────────────────────────────────────
  //           MODAL / BOTTOM SHEET
  // ───────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [modalOpenIdx, setModalOpenIdx] = useState<number | null>(null);

  const backdrop = useRef(new Animated.Value(0)).current; // 0 → transparente, 1 → oscuro
  const sheetY = useRef(new Animated.Value(1)).current; // 1 → fuera, 0 → visible

  const openModal = (focusIdx?: number | null) => {
    if (focusIdx != null) setModalOpenIdx(focusIdx);
    setModalVisible(true);
  };

  const animateIn = useCallback(() => {
    backdrop.setValue(0);
    sheetY.setValue(1);
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetY, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdrop, sheetY]);

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetY, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setModalVisible(false);
        setModalOpenIdx(null);
      }
    });
  };

  useEffect(() => {
    if (modalVisible) animateIn();
  }, [modalVisible, animateIn]);

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

  const headerCounter = `${entries.length} registro${entries.length === 1 ? "" : "s"}`;

  // Tarjeta para la lista del modal
  const renderModalCard = (row: Record<string, any>, idx: number) => {
    const missing = countMissingRequired(row, fieldsTemplate);
    const isOpen = modalOpenIdx === idx;

    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: missing ? colors.danger600 : colors.border,
          borderRadius: cardRadius,
          backgroundColor: colors.neutral0,
        }}
      >
        <View style={{ padding: cardPad, gap: 6 }}>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
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

          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
            <TouchableOpacity
              onPress={() => setModalOpenIdx(isOpen ? null : idx)}
              activeOpacity={0.9}
              style={{
                flex: 1,
                height: touch,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primary600,
              }}
              testID="row-edit-modal"
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
                testID="row-delete-modal"
              >
                <Text style={{ color: colors.danger600, fontWeight: "900", fontSize: 13 }}>
                  Eliminar
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {isOpen && (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              padding: cardPad,
              gap: 8,
              backgroundColor: colors.neutral0,
              borderBottomLeftRadius: cardRadius,
              borderBottomRightRadius: cardRadius,
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
                onPress={() => setModalOpenIdx(null)}
                activeOpacity={0.9}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: minSide * 0.02,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: "#F3F3F3",
                }}
                testID="row-done-modal"
              >
                <Text style={{ fontWeight: "800", color: colors.textSecondary, fontSize: 13 }}>
                  Listo
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

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
          {/* contador “pill” */}
          <TouchableOpacity
            onPress={() => openModal(entries.length ? 0 : null)}
            activeOpacity={0.9}
            style={{
              paddingHorizontal: minSide * 0.25,
              paddingVertical: 10,
              borderRadius: minSide * 0.02,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.neutral0,
            }}
            testID="group-open-modal"
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 13 }}>
              Ver registros
            </Text>
          </TouchableOpacity>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "rgba(45,138,36,0.08)",
              borderWidth: 1,
              borderColor: "rgba(45,138,36,0.25)",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: minSide * 0.02,
            }}
            accessibilityRole="text"
            accessibilityLabel={headerCounter}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.primary600,
                marginRight: 6,
              }}
            />
            <Text style={{ color: colors.primary600, fontWeight: "900" }}>{entries.length}</Text>
            <Text style={{ color: colors.textSecondary, marginLeft: 4 }}>
              registro{entries.length === 1 ? "" : "s"}
            </Text>
          </View>
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

      {/* MODAL / BOTTOM SHEET de registros */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={closeModal}
        statusBarTranslucent
      >
        {/* Backdrop oscuro con fade */}
        <Animated.View
          style={[
            {
              flex: 1,
              backgroundColor: "#000",
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
            },
            { opacity: backdrop.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }) },
          ]}
        />

        {/* Tap fuera cierra */}
        <Pressable
          style={{ flex: 1 }}
          onPress={closeModal}
          android_ripple={{ color: "transparent" }}
        />

        {/* Sheet que sube desde abajo */}
        <Animated.View
          style={[
            {
              alignSelf: "stretch",
              backgroundColor: colors.neutral0,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: Platform.select({ ios: 24, android: 16 }),
              maxHeight: sheetMaxH,
            },
            {
              transform: [
                {
                  translateY: sheetY.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, sheetMaxH + 40],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Header del modal: título + contador + agregar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <Text style={{ fontWeight: "900", fontSize: 16, color: colors.textPrimary }}>
              {title}
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "rgba(45,138,36,0.08)",
                  borderWidth: 1,
                  borderColor: "rgba(45,138,36,0.25)",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: minSide * 0.02,
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.primary600,
                    marginRight: 6,
                  }}
                />
                <Text style={{ color: colors.primary600, fontWeight: "900" }}>
                  {entries.length}
                </Text>
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
                testID="group-add-modal"
              >
                <Text style={{ color: "white", fontWeight: "900", fontSize: 13 }}>
                  Agregar registro
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Lista o estado vacío */}
          {entries.length === 0 ? (
            <EmptyState />
          ) : (
            <FlatList
              data={entries}
              keyExtractor={(_r, i) => `modal-row-${i}`}
              ItemSeparatorComponent={() => <View style={{ height: gap }} />}
              contentContainerStyle={{ paddingBottom: 8 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: row, index: idx }) => renderModalCard(row, idx)}
            />
          )}

          {/* Botón cerrar */}
          <TouchableOpacity
            onPress={closeModal}
            activeOpacity={0.9}
            style={{
              marginTop: 8,
              alignSelf: "stretch",
              paddingVertical: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: "#F3F3F3",
            }}
            testID="group-close-modal"
          >
            <Text style={{ textAlign: "center", color: colors.textSecondary, fontWeight: "800" }}>
              Cerrar
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </View>
  );
};

export default React.memo(GroupEditor);
