// src/components/molecules/FormListItem.tsx
import { Body } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import { useFocusEffect } from "@react-navigation/native";
import React, { useEffect, useMemo, useRef } from "react";
import { Image, ImageSourcePropType, Pressable, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import IconButton from "../atoms/IconButton";

type Frame = { width: number; height: number };

type Props = {
  title: string;

  /** ====== Props existentes (retro-compat) ====== */
  statusText?: string; // opcional ahora
  statusColor?: string; // opcional ahora
  assignedAt?: Date | null;
  availableUntil?: Date | null;
  onPress?: () => void;
  onPreload?: () => void | Promise<void>;
  referenceFrame: Frame;
  contentFrame: Frame;
  leadingIcon?: ImageSourcePropType;
  enterIcon?: ImageSourcePropType;
  style?: ViewStyle;

  /** ====== NUEVOS (multi-instancia/periodo) ====== */
  periodLabel?: string; // ej. “hoy” | “esta semana” | “este mes”
  draftCount?: number; // borradores
  readyCount?: number; // listos para enviar
  submittedCount?: number; // enviados
  limit?: number | null; // null = sin límite
  reachedLimit?: boolean; // true cuando total >= limit
  suspended?: boolean; // form suspendido (server)
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const baseStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral0,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
    overflow: "hidden",
  },
});

// const StatusDot: React.FC<{ color?: string; size?: number }> = ({ color = "#888", size = 8 }) => (
//   <View
//     style={{
//       width: size,
//       height: size,
//       borderRadius: 999,
//       backgroundColor: color,
//       marginLeft: 6,
//       marginBottom: 1,
//     }}
//   />
// );

const Badge: React.FC<{ label: string; fg: string; bg: string; size?: number }> = ({
  label,
  fg,
  bg,
  size = 12,
}) => (
  <View
    style={{
      paddingHorizontal: size * 0.8,
      paddingVertical: size * 0.35,
      borderRadius: size * 0.75,
      backgroundColor: bg,
    }}
  >
    <Body size="xxs" style={{ color: fg, fontWeight: "700" }}>
      {label}
    </Body>
  </View>
);

// const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
// const formatFechaCorta = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const FormListItem: React.FC<Props> = ({
  title,

  // // antiguos (opcionales ahora)
  // statusText,
  // statusColor = "#8A8A8A",
  // assignedAt,
  // availableUntil,
  onPress,
  onPreload,

  // frames
  referenceFrame,
  contentFrame,

  // íconos
  leadingIcon = require("../../../assets/images/form.png"),
  enterIcon = require("../../../assets/images/enter.png"),

  // nuevos
  // periodLabel,
  draftCount = 0,
  readyCount = 0,
  submittedCount = 0,
  // limit = null,
  // reachedLimit = false,
  suspended = false,

  style,
}) => {
  const {
    padCard,
    padRight,
    minCardHeight,
    rowGap,
    iconSize,
    // statusDotSize,
    enterBtnSize,
    titleSize,
    badgeGap,
    ribbonHeight,
  } = useMemo(() => {
    const minSide = Math.min(referenceFrame.width, referenceFrame.height);
    const gapY = clamp(contentFrame.width * 0.04, 12, 24);
    const _pad = clamp(minSide * 0.02, 12, 20);
    const _titleSize = clamp(minSide * 0.038, 16, 22);
    const _rowGap = clamp(minSide * 0.012, 6, 12);
    const _iconSize = clamp(minSide * 0.055, 18, 24);
    const _statusDot = clamp(minSide * 0.012, 6, 10);
    const _minH = clamp(minSide * 0.12, 72, 104);
    const _enter = clamp(minSide * 0.055, 28, 40);
    const _badgeGap = clamp(minSide * 0.012, 6, 12);
    const _ribbonH = clamp(minSide * 0.032, 16, 22);

    return {
      padCard: _pad,
      padRight: _pad + _enter + gapY * 0.5,
      minCardHeight: _minH,
      rowGap: _rowGap,
      iconSize: _iconSize,
      titleSize: _titleSize,
      statusDotSize: _statusDot,
      enterBtnSize: _enter,
      badgeGap: _badgeGap,
      ribbonHeight: _ribbonH,
    };
  }, [referenceFrame, contentFrame]);

  // animación táctil (igual que antes)
  const scale = useSharedValue(1);
  const overlay = useSharedValue(0);
  const animatingRef = useRef(false);
  const preloadedRef = useRef(false);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navDelayMs = 160;
  const unlockDelayMs = 360;
  const springInCfg = { stiffness: 320, damping: 20, mass: 1, overshootClamping: true };
  const springOutCfg = { stiffness: 220, damping: 18, mass: 1, overshootClamping: true };
  const animatedCard = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const animatedOverlay = useAnimatedStyle(() => ({ opacity: overlay.value * 0.06 }));

  useFocusEffect(
    React.useCallback(() => {
      if (unlockTimerRef.current) {
        clearTimeout(unlockTimerRef.current);
        unlockTimerRef.current = null;
      }
      cancelAnimation(scale);
      cancelAnimation(overlay);
      scale.value = 1;
      overlay.value = 0;
      animatingRef.current = false;
      preloadedRef.current = false;

      return () => {
        if (unlockTimerRef.current) {
          clearTimeout(unlockTimerRef.current);
          unlockTimerRef.current = null;
        }
        cancelAnimation(scale);
        cancelAnimation(overlay);
        animatingRef.current = false;
      };
    }, [overlay, scale])
  );

  useEffect(() => {
    return () => {
      if (unlockTimerRef.current) {
        clearTimeout(unlockTimerRef.current);
        unlockTimerRef.current = null;
      }
      cancelAnimation(scale);
      cancelAnimation(overlay);
      animatingRef.current = false;
    };
  }, [overlay, scale]);

  // const total = draftCount + readyCount + submittedCount;
  // // const limitText = limit == null ? "Sin límite" : `${Math.min(total, limit)}/${limit}`;

  const handlePressIn = () => {
    if (!preloadedRef.current && onPreload) {
      preloadedRef.current = true;
      try {
        onPreload();
      } catch {}
    }
    overlay.value = withTiming(1, { duration: 90 });
    scale.value = withSpring(0.97, springInCfg);
  };

  const handlePressOut = () => {
    if (animatingRef.current) return;
    overlay.value = withTiming(0, { duration: 140 });
    scale.value = withSpring(1, springOutCfg);
  };

  const handlePress = () => {
    if (animatingRef.current) return;
    animatingRef.current = true;

    overlay.value = withTiming(1, { duration: 60 });
    scale.value = withSpring(0.94, springInCfg, () => {
      scale.value = withSpring(1, springOutCfg);
    });
    overlay.value = withTiming(0, { duration: 200 });

    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = setTimeout(() => {
      animatingRef.current = false;
      preloadedRef.current = false;
    }, unlockDelayMs);

    if (onPress) {
      setTimeout(() => {
        animatingRef.current = false;
        preloadedRef.current = false;
        runOnJS(onPress)();
      }, navDelayMs);
    }
  };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[
        baseStyles.card,
        { padding: padCard, paddingRight: padRight, minHeight: minCardHeight },
        animatedCard,
        style,
      ]}
    >
      {/* Cinta de SUSPENDIDO */}
      {suspended ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: ribbonHeight,
            backgroundColor: "#FFD7BF",
            justifyContent: "center",
            alignItems: "center",
          }}
          pointerEvents="none"
        >
          <Body size="xs" style={{ color: "#8A4300", fontWeight: "800" }}>
            FORMULARIO SUSPENDIDO
          </Body>
        </View>
      ) : null}

      {/* Overlay sutil */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: "#000",
            borderRadius: 12,
          },
          animatedOverlay,
        ]}
      />

      {/* Título */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: rowGap,
          marginBottom: rowGap * 0.75,
          marginTop: suspended ? ribbonHeight + 4 : 0,
        }}
      >
        <Image
          source={leadingIcon}
          style={{ width: iconSize, height: iconSize, marginTop: 2 }}
          resizeMode="contain"
        />
        <Body size="sm" color="tertiary" weight="bold" style={{ fontSize: titleSize }}>
          {title}
        </Body>
      </View>

      {/* Línea “estado corto” (retro-compat si no usas counts) */}
      {/* {statusText ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: rowGap * 0.5,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Body frame={referenceFrame} weight="bold" size="xs">
              {statusText}
            </Body>
            <StatusDot size={statusDotSize} color={statusColor} />
          </View>
          {assignedAt ? (
            <Body frame={referenceFrame} color="secondary" size="xs">
              Asignado el {formatFechaCorta(assignedAt)}
            </Body>
          ) : null}
        </View>
      ) : null} */}

      {/* NUEVA línea con badges y cupo */}
      <View style={{ gap: rowGap * 0.5 }}>
        {/* Badges por estado */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: badgeGap * 1.8 }}>
          {draftCount > 0 ? (
            <Badge label={`Borradores ${draftCount}`} fg="#1E51B8" bg="#E8F0FF" />
          ) : null}
          {readyCount > 0 ? (
            <Badge label={`En progreso ${readyCount}`} fg="#8A5A00" bg="#FFF4D6" />
          ) : (
            <Badge label="En progreso 0" fg="#666" bg="#F0F0F0" />
          )}
          {submittedCount > 0 ? (
            <Badge label={`Enviados ${submittedCount}`} fg="#1E7D2B" bg="#EAF7EA" />
          ) : (
            <Badge label="Enviados 0" fg="#666" bg="#F0F0F0" />
          )}
        </View>
      </View>

      {/* Icono decorativo */}
      <View
        style={{
          position: "absolute",
          right: padCard,
          top: 0,
          bottom: 0,
          justifyContent: "center",
          opacity: suspended ? 0.45 : 1,
        }}
        pointerEvents="none"
      >
        <IconButton
          frame={referenceFrame}
          size={enterBtnSize}
          iconSize={iconSize}
          iconSource={enterIcon}
          disabled
          showShadow={false}
        />
      </View>
    </AnimatedPressable>
  );
};

export default FormListItem;
