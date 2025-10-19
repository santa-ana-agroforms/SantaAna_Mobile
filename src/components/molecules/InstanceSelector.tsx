// src/components/molecules/InstanceSelector.tsx
import { colors } from "@/theme/tokens";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Modal,
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
  onClose: () => void; // lo llamamos tras animar el cierre
  referenceFrame: Frame;
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

const StatusPill: React.FC<{ status: EntryStatus; size?: number }> = ({ status, size = 12 }) => {
  const label =
    status === "in_progress" ? "Borrador" : status === "ready_for_submit" ? "Listo" : "Enviado";
  const bg =
    status === "in_progress"
      ? "#E9F0FF"
      : status === "ready_for_submit"
        ? colors.warningBg
        : "#EAF7EA";
  const fg =
    status === "in_progress"
      ? colors.textSecondary
      : status === "ready_for_submit"
        ? colors.textTertiary
        : colors.primary600;

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

const Chip: React.FC<{ label: string; active?: boolean; onPress?: () => void; size: number }> = ({
  label,
  active,
  onPress,
  size,
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      paddingHorizontal: size * 0.9,
      paddingVertical: size * 0.5,
      borderRadius: size * 0.75,
      backgroundColor: active ? colors.primary600 : colors.neutral0,
      borderWidth: 1,
      borderColor: active ? colors.primary600 : colors.border,
    }}
  >
    <Text style={{ color: active ? colors.neutral0 : colors.textPrimary, fontWeight: "700" }}>
      {label}
    </Text>
  </TouchableOpacity>
);

const Divider: React.FC<{ inset?: boolean; color?: string; opacity?: number }> = ({
  inset = false,
  color = colors.border,
  opacity = 0.6,
}) => <View style={{ height: 1, backgroundColor: color, marginLeft: inset ? 12 : 0, opacity }} />;

const InstanceSelector: React.FC<InstanceSelectorProps> = ({
  visible,
  periodLabel,
  entries,
  allowNew,
  onNew,
  onOpen,
  onClose,
  referenceFrame,
  contentFrame,
}) => {
  const minSide = Math.min(referenceFrame.width, referenceFrame.height);

  // responsive
  const pad = minSide * 0.035;
  const gap = clamp(contentFrame.width * 0.032, 8, 18);
  const radius = clamp(minSide * 0.02, 12, 16);
  const titleSize = clamp(minSide * 0.042, 16, 22);
  const subtitleSize = clamp(minSide * 0.034, 13, 18);
  const chipSize = clamp(minSide * 0.032, 12, 16);
  const cardPad = clamp(minSide * 0.02, 10, 16);
  const btnH = clamp(minSide * 0.064, 44, 56);
  const handleW = clamp(minSide * 0.14, 36, 56);
  const handleH = clamp(minSide * 0.012, 4, 6);

  // animaciones
  const overlayA = useRef(new Animated.Value(0)).current;
  const sheetA = useRef(new Animated.Value(0)).current;

  const playIn = () =>
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

  const playOut = (after?: () => void) =>
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

  useEffect(() => {
    if (visible) playIn();
  }, [visible]);

  // filtro
  type FilterKey = "all" | EntryStatus;
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return entries;
    return entries.filter((e) => e.status === filter);
  }, [entries, filter]);

  const counts = useMemo(() => {
    let inProgress = 0,
      ready = 0,
      submitted = 0;
    for (const e of entries) {
      if (e.status === "in_progress") inProgress++;
      else if (e.status === "ready_for_submit") ready++;
      else submitted++;
    }
    return { inProgress, ready, submitted, total: entries.length };
  }, [entries]);

  const cardStyle = {
    padding: cardPad,
    borderRadius: 12,
    backgroundColor: colors.neutral0,
    borderWidth: 1,
    borderColor: colors.border,
  } as const;

  // helpers UI
  const getDisplayName = (idx: number, item: EntryPreview) =>
    item.instanceName?.trim() || `Registro ${idx + 1}`;

  const handleTapOpen = (item: EntryPreview, mode: "edit" | "review" | "view") => () => {
    // cierra con animación y luego navega
    playOut(() => onOpen(item, mode));
  };

  const handleTapNew = () => playOut(onNew);
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
          <View style={{ paddingHorizontal: pad, gap: 4, marginBottom: gap * 0.5 }}>
            <Text style={{ fontWeight: "800", fontSize: titleSize, color: colors.textPrimary }}>
              Registros de {periodLabel}
            </Text>
            {/* <Text style={{ color: colors.textSecondary, fontSize: subtitleSize }}>
              {counts.total} en total • {counts.inProgress} Borrador • {counts.ready} Listo •{" "}
              {counts.submitted} Enviado
            </Text> */}
          </View>

          {/* chips */}
          <View
            style={{
              paddingHorizontal: pad,
              flexDirection: "row",
              gap,
              marginBottom: gap * 0.5,
              flexWrap: "wrap",
            }}
          >
            <Chip
              label="Todos"
              active={filter === "all"}
              onPress={() => setFilter("all")}
              size={chipSize}
            />
            <Chip
              label={`Borrador (${counts.inProgress})`}
              active={filter === "in_progress"}
              onPress={() => setFilter("in_progress")}
              size={chipSize}
            />
            <Chip
              label={`En revisión (${counts.ready})`}
              active={filter === "ready_for_submit"}
              onPress={() => setFilter("ready_for_submit")}
              size={chipSize}
            />
            <Chip
              label={`Enviado (${counts.submitted})`}
              active={filter === "submitted"}
              onPress={() => setFilter("submitted")}
              size={chipSize}
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
              const primary =
                item.status === "in_progress"
                  ? {
                      label: "Continuar",
                      mode: "edit" as const,
                      color: colors.primary600,
                      bg: "#E9F6EA",
                    }
                  : item.status === "ready_for_submit"
                    ? {
                        label: "Revisar",
                        mode: "review" as const,
                        color: colors.textTertiary,
                        bg: "#FFF7E2",
                      }
                    : {
                        label: "Ver",
                        mode: "view" as const,
                        color: colors.textSecondary,
                        bg: "#F3F3F3",
                      };
              const showSecondary = item.status === "ready_for_submit";

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
                    <StatusPill status={item.status} />
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
                      onPress={handleTapOpen(item, primary.mode)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: primary.bg,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ fontWeight: "800", color: primary.color }}>
                        {primary.label}
                      </Text>
                    </TouchableOpacity>

                    {showSecondary && (
                      <TouchableOpacity
                        onPress={handleTapOpen(item, "edit")}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 10,
                          backgroundColor: "#E9F6EA",
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ fontWeight: "700", color: colors.primary600 }}>Editar</Text>
                      </TouchableOpacity>
                    )}
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
                onPress={handleTapNew}
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
