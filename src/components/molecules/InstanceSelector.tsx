// src/components/molecules/InstanceSelector.tsx
import { colors } from "@/theme/tokens";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type Frame = { width: number; height: number };
export type EntryStatus = "in_progress" | "ready_for_submit" | "submitted";

export type EntryPreview = {
  id: string;
  instanceName?: string | null;
  status: EntryStatus;
  createdAt: number;
  updatedAt: number;
};

export type InstanceSelectorProps = {
  visible: boolean;
  periodLabel: string;
  entries: EntryPreview[];
  allowNew: boolean;
  onNew: () => void;
  onOpen: (entry: EntryPreview, mode: "edit" | "review" | "view") => void;
  onSubmit: (entry: EntryPreview) => void; // envío directo si está listo
  onClose: () => void;
  referenceFrame: Frame;
  formName: string;
  contentFrame: Frame;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const format2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const formatDateTime = (ts: number) => {
  try {
    const d = new Date(ts);
    const dd = `${format2(d.getDate())}/${format2(d.getMonth() + 1)}/${d.getFullYear()}`;
    const hh = `${format2(d.getHours())}:${format2(d.getMinutes())}`;
    return `${dd} · ${hh}`;
  } catch {
    return "";
  }
};

/** Solo 2 estados de UI */
type UIStatus = "reviewable" | "submitted";
const toUIStatus = (s: EntryStatus): UIStatus => (s === "submitted" ? "submitted" : "reviewable");

const StatusPill: React.FC<{ ui: UIStatus; size?: number }> = ({ ui, size = 12 }) => {
  const label = ui === "reviewable" ? "En revisión" : "Enviado";
  const bg = ui === "reviewable" ? colors.warningBg : "#EAF7EA";
  const fg = ui === "reviewable" ? colors.textTertiary : colors.primary600;

  return (
    <View
      style={{
        paddingHorizontal: size * 0.9,
        paddingVertical: size * 0.45,
        borderRadius: size * 0.75,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: fg, fontWeight: "700" }}>{label}</Text>
    </View>
  );
};

const Divider: React.FC<{ inset?: boolean; color?: string; opacity?: number }> = ({
  inset = false,
  color = colors.border,
  opacity = 0.6,
}) => <View style={{ height: 1, backgroundColor: color, marginLeft: inset ? 12 : 0, opacity }} />;

/* =========================================================
 * SegmentedPill — control de pestañas con thumb draggable
 * Todo escalado con minSide.
 * =======================================================*/
type Segment = { key: string; label: string; count?: number };
type SegmentedPillProps = {
  minSide: number;
  segments: Segment[];
  valueKey: string; // key activa
  onChange: (key: string) => void;
};

const SegmentedPill: React.FC<SegmentedPillProps> = ({ minSide, segments, valueKey, onChange }) => {
  const containerPad = clamp(minSide * 0.008, 2, 6);
  const height = clamp(minSide * 0.1, 44, 56);
  const radius = clamp(minSide * 0.02, 10, 14);
  const thumbRadius = clamp(minSide * 0.018, 8, 12);
  const badgeH = clamp(minSide * 0.06, 22, 28);
  const badgePadH = clamp(minSide * 0.014, 8, 12);
  const labelFs = clamp(minSide * 0.04, 13, 16);

  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const activeIndex = Math.max(
    0,
    segments.findIndex((s) => s.key === valueKey)
  );

  const x = useRef(new Animated.Value(activeIndex)).current;
  useEffect(() => {
    Animated.spring(x, {
      toValue: activeIndex,
      useNativeDriver: true,
      stiffness: 260,
      damping: 26,
      mass: 0.9,
    }).start();
  }, [activeIndex, x]);

  const padding = containerPad;
  const innerWidth = Math.max(width - padding * 2, 0);
  const segWidth = segments.length > 0 ? innerWidth / segments.length : 0;

  // Drag con PanResponder
  const startRef = useRef(0);
  const pan = useRef(new Animated.Value(0)).current;
  const dragging = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragging.current = true;
        pan.setValue(0);
        startRef.current = (x as any)._value ?? activeIndex;
      },
      onPanResponderMove: (_, g) => {
        if (!dragging.current) return;
        const delta = g.dx / (segWidth || 1);
        const next = clamp(startRef.current + delta, 0, segments.length - 1);
        x.setValue(next);
      },
      onPanResponderRelease: () => {
        dragging.current = false;
        const idx = Math.round((x as any)._value ?? activeIndex);
        const nextKey = segments[clamp(idx, 0, segments.length - 1)].key;
        onChange(nextKey);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        dragging.current = false;
        const idx = Math.round((x as any)._value ?? activeIndex);
        const nextKey = segments[clamp(idx, 0, segments.length - 1)].key;
        onChange(nextKey);
      },
    })
  ).current;

  const translateX = x.interpolate({
    inputRange: [0, segments.length - 1 || 1],
    outputRange: [0, Math.max(segWidth * (segments.length - 1), 0)],
  });

  const pressTab = (idx: number) => {
    const key = segments[idx].key;
    onChange(key);
  };

  return (
    <View
      onLayout={onLayout}
      style={{
        height,
        borderRadius: radius,
        backgroundColor: colors.neutral0,
        borderWidth: 1,
        borderColor: colors.border,
        padding,
        overflow: "hidden",
        justifyContent: "center",
      }}
      accessibilityRole="tablist"
    >
      {/* thumb */}
      <Animated.View
        {...panResponder.panHandlers}
        style={{
          position: "absolute",
          left: padding,
          width: segWidth,
          height: height - padding * 2,
          borderRadius: thumbRadius,
          backgroundColor: colors.primary600,
          transform: [{ translateX }],
        }}
        accessibilityLabel="Control deslizante"
        accessibilityHint="Arrastra para cambiar de pestaña"
      />

      {/* tabs */}
      <View style={{ flexDirection: "row", paddingHorizontal: padding }}>
        {segments.map((s, i) => {
          const isActive = valueKey === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => pressTab(i)}
              style={{
                width: segWidth,
                height: height - padding * 2,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: clamp(minSide * 0.01, 4, 8),
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={{
                  fontWeight: "800",
                  fontSize: labelFs,
                  color: isActive ? colors.neutral0 : colors.textPrimary,
                }}
                numberOfLines={1}
              >
                {s.label}
              </Text>

              <View
                style={{
                  minWidth: badgeH,
                  height: badgeH,
                  paddingHorizontal: badgePadH,
                  borderRadius: clamp(minSide * 0.016, 8, 12),
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isActive ? "rgba(255,255,255,0.25)" : "#EFEFEF",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    fontWeight: "800",
                    fontSize: clamp(minSide * 0.032, 11, 13),
                    color: isActive ? colors.neutral0 : colors.textPrimary,
                  }}
                >
                  {s.count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

/* =========================================================
 * InstanceSelector
 * =======================================================*/
const InstanceSelector: React.FC<InstanceSelectorProps> = ({
  visible,
  periodLabel,
  entries,
  allowNew,
  onNew,
  onOpen,
  onSubmit,
  onClose,
  formName,
  referenceFrame,
}) => {
  const minSide = Math.min(referenceFrame.width, referenceFrame.height);

  // responsive escalado con minSide
  const pad = clamp(minSide * 0.035, 14, 24);
  const gap = clamp(minSide * 0.028, 8, 18);
  const radius = clamp(minSide * 0.02, 12, 16);
  const titleSize = clamp(minSide * 0.042, 16, 22);
  const subtitleSize = clamp(minSide * 0.034, 13, 18);
  const cardPad = clamp(minSide * 0.02, 10, 16);
  const btnH = clamp(minSide * 0.064, 44, 56);
  const handleW = clamp(minSide * 0.14, 36, 56);
  const handleH = clamp(minSide * 0.012, 4, 6);

  // animaciones modales
  const overlayA = useRef(new Animated.Value(0)).current;
  const sheetA = useRef(new Animated.Value(0)).current;

  const playIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(overlayA, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetA, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [overlayA, sheetA]);

  const playOut = useCallback(
    (after?: () => void) => {
      Animated.parallel([
        Animated.timing(overlayA, {
          toValue: 0,
          duration: 140,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sheetA, {
          toValue: 0,
          duration: 160,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) onClose();
        if (after) after();
      });
    },
    [overlayA, sheetA, onClose]
  );

  useEffect(() => {
    if (visible) playIn();
  }, [visible, playIn]);

  /** --------- NUEVO SEGMENTED PILL --------- */
  type FilterKey = "reviewable" | "submitted";
  const [filter, setFilter] = useState<FilterKey>("reviewable");

  /** Contadores combinados */
  const counts = useMemo(() => {
    let reviewable = 0;
    let submitted = 0;
    for (const e of entries) {
      if (toUIStatus(e.status) === "reviewable") {
        reviewable++;
      } else {
        submitted++;
      }
    }
    return { reviewable, submitted, total: entries.length };
  }, [entries]);

  /** Lista filtrada por pestaña */
  const filtered = useMemo(
    () =>
      entries.filter((e) =>
        filter === "submitted"
          ? toUIStatus(e.status) === "submitted"
          : toUIStatus(e.status) === "reviewable"
      ),
    [entries, filter]
  );

  const cardStyle = {
    padding: cardPad,
    borderRadius: 12,
    backgroundColor: colors.neutral0,
    borderWidth: 1,
    borderColor: colors.border,
  } as const;

  const getDisplayName = (idx: number, item: EntryPreview) =>
    item.instanceName?.trim() || `Registro ${idx + 1}`;

  // helpers
  const openThen = (fn: () => void) => () => playOut(fn);
  const handleTapOverlay = () => playOut();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleTapOverlay}>
      {/* overlay */}
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: "#000",
          opacity: overlayA.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
        }}
      >
        <Pressable onPress={handleTapOverlay} style={{ flex: 1 }} />
      </Animated.View>

      {/* sheet */}
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          transform: [
            {
              translateY: sheetA.interpolate({
                inputRange: [0, 1],
                outputRange: [referenceFrame.height * 0.9, 0],
              }),
            },
          ],
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
            paddingBottom: pad,
            maxHeight: referenceFrame.height * 0.88,
            borderTopWidth: 1,
            borderColor: colors.border,
          }}
        >
          {/* handle */}
          <View style={{ alignItems: "center", paddingTop: pad, paddingBottom: pad * 0.6 }}>
            <View
              style={{
                width: handleW,
                height: handleH,
                borderRadius: 999,
                backgroundColor: colors.border,
                opacity: 0.8,
              }}
            />
          </View>

          {/* header */}
          <View style={{ paddingHorizontal: pad, gap: 8, marginBottom: gap * 0.5 }}>
            <Text style={{ fontWeight: "800", fontSize: titleSize, color: colors.textPrimary }}>
              Registros de {periodLabel} - {formName}
            </Text>

            {/* ===== NUEVO SegmentedPill (2 pestañas) ===== */}
            <SegmentedPill
              minSide={minSide}
              valueKey={filter}
              onChange={(key) => setFilter(key as FilterKey)}
              segments={[
                { key: "reviewable", label: "En revisión", count: counts.reviewable },
                { key: "submitted", label: "Enviados", count: counts.submitted },
              ]}
            />
          </View>

          <Divider color={colors.border} opacity={0.4} />

          {/* lista */}
          <FlatList
            contentContainerStyle={{ padding: pad, paddingBottom: pad * 0.5, gap }}
            data={filtered}
            keyExtractor={(e) => e.id}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() => (
              <View style={[cardStyle, { alignItems: "center" }]}>
                <Text style={{ color: colors.textSecondary }}>
                  No hay registros para este filtro.
                </Text>
              </View>
            )}
            renderItem={({ item, index }) => {
              const ui = toUIStatus(item.status);

              // Acción única por tarjeta
              let label: string;
              let handler: () => void;
              let bg: string;
              let fg: string;

              if (ui === "submitted") {
                label = "Ver";
                handler = openThen(() => onOpen(item, "view"));
                bg = "#F3F3F3";
                fg = colors.textSecondary;
              } else if (item.status === "ready_for_submit") {
                label = "Enviar";
                handler = openThen(() => onSubmit(item)); // envío directo
                bg = "#E6F7EA";
                fg = colors.primary600;
              } else {
                // in_progress → Continuar en modo review
                label = "Continuar";
                handler = openThen(() => onOpen(item, "review"));
                bg = "#FFF7E2";
                fg = colors.textTertiary;
              }

              return (
                <View style={cardStyle}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: gap * 0.4,
                    }}
                  >
                    <View style={{ flexShrink: 1, paddingRight: 8 }}>
                      <Text
                        style={{ fontWeight: "700", color: colors.textPrimary }}
                        numberOfLines={1}
                      >
                        {getDisplayName(index, item)}
                      </Text>
                      <Text
                        style={{
                          color: colors.textSecondary,
                          marginTop: 2,
                          fontSize: subtitleSize,
                        }}
                      >
                        {formatDateTime(item.updatedAt || item.createdAt)}
                      </Text>
                    </View>
                    <StatusPill ui={ui} size={clamp(minSide * 0.03, 10, 14)} />
                  </View>

                  <Divider inset />

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap,
                      paddingTop: gap * 0.6,
                      flexWrap: "wrap",
                    }}
                  >
                    <TouchableOpacity
                      onPress={handler}
                      style={{
                        paddingHorizontal: clamp(minSide * 0.035, 12, 16),
                        paddingVertical: clamp(minSide * 0.025, 8, 12),
                        borderRadius: clamp(minSide * 0.024, 8, 12),
                        backgroundColor: bg,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ fontWeight: "800", color: fg }}>{label}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ListFooterComponent={<View style={{ height: gap * 0.5 }} />}
          />

          {/* acciones inferiores */}
          <View style={{ paddingHorizontal: pad, gap: 8 }}>
            {allowNew && (
              <TouchableOpacity
                onPress={openThen(onNew)}
                style={{
                  height: btnH,
                  borderRadius: 12,
                  backgroundColor: colors.primary600,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.primary600,
                }}
              >
                <Text style={{ color: colors.neutral0, fontWeight: "800" }}>+ Nuevo registro</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleTapOverlay}
              style={{
                height: Math.max(btnH * 0.9, 40),
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
};

export default InstanceSelector;
