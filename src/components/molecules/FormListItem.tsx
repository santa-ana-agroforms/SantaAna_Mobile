// src/components/molecules/FormListItem.tsx
import IconButton from "@/components/atoms/IconButton";
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

type Frame = { width: number; height: number };

type Props = {
  title: string;
  statusText: string;
  statusColor: string;
  assignedAt?: Date | null;
  availableUntil?: Date | null;
  onPress?: () => void;
  /** Se llama en onPressIn para empezar a precargar la siguiente pantalla/datos */
  onPreload?: () => void | Promise<void>;
  referenceFrame: Frame;
  contentFrame: Frame;
  leadingIcon?: ImageSourcePropType;
  enterIcon?: ImageSourcePropType;
  style?: ViewStyle;
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
  },
});

const StatusDot: React.FC<{ color?: string; size?: number }> = ({ color = "#888", size = 8 }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: 999,
      backgroundColor: color,
      marginLeft: 6,
      marginBottom: 1,
    }}
  />
);

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const formatFechaCorta = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const FormListItem: React.FC<Props> = ({
  title,
  statusText,
  statusColor,
  assignedAt,
  availableUntil,
  onPress,
  onPreload,
  referenceFrame,
  contentFrame,
  leadingIcon = require("../../../assets/images/form.png"),
  enterIcon = require("../../../assets/images/enter.png"),
  style,
}) => {
  const {
    padCard,
    padRight,
    minCardHeight,
    rowGap,
    iconSize,
    statusDotSize,
    enterBtnSize,
    titleSize,
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

    return {
      padCard: _pad,
      padRight: _pad + _enter + gapY * 0.5,
      minCardHeight: _minH,
      rowGap: _rowGap,
      iconSize: _iconSize,
      titleSize: _titleSize,
      statusDotSize: _statusDot,
      enterBtnSize: _enter,
    };
  }, [referenceFrame, contentFrame]);

  // Animación de toque
  const scale = useSharedValue(1);
  const overlay = useSharedValue(0);
  const animatingRef = useRef(false);
  const preloadedRef = useRef(false);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timings
  const navDelayMs = 160; // navegar tras ver el “tap” (squish corto)
  const unlockDelayMs = 360; // liberar lock por si la animación se cancela al navegar

  // Springs
  const springInCfg = { stiffness: 320, damping: 20, mass: 1, overshootClamping: true };
  const springOutCfg = { stiffness: 220, damping: 18, mass: 1, overshootClamping: true };

  const animatedCard = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const animatedOverlay = useAnimatedStyle(() => ({ opacity: overlay.value * 0.06 }));

  // Reset robusto al reenfocar la lista
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

  // Cleanup por si el item se desmonta
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

  const handlePressIn = () => {
    if (!preloadedRef.current && onPreload) {
      preloadedRef.current = true;
      try {
        onPreload();
      } catch {}
    }
    overlay.value = withTiming(1, { duration: 90 });
    // “encoge” sutil mientras se mantiene presionado
    scale.value = withSpring(0.97, springInCfg);
  };

  const handlePressOut = () => {
    if (animatingRef.current) return; // si ya disparamos la secuencia de press, no hacemos bounce aquí
    overlay.value = withTiming(0, { duration: 140 });
    scale.value = withSpring(1, springOutCfg);
  };

  const handlePress = () => {
    if (animatingRef.current) return;
    animatingRef.current = true;

    // Squish visible de tap: 0.97 → 0.94 y rebote
    overlay.value = withTiming(1, { duration: 60 });
    scale.value = withSpring(0.94, springInCfg, () => {
      scale.value = withSpring(1, springOutCfg);
    });
    overlay.value = withTiming(0, { duration: 200 });

    // Fallback: liberar lock aunque la animación quede cancelada por la navegación
    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = setTimeout(() => {
      animatingRef.current = false;
      preloadedRef.current = false;
    }, unlockDelayMs);

    // Navegar tras un delay fijo corto (no dependemos del callback del spring)
    if (onPress) {
      setTimeout(() => {
        animatingRef.current = false; // soltar por si el usuario vuelve rápido
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

      {/* Estado + asignación */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: rowGap * 0.25,
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

      {/* Disponible hasta */}
      {availableUntil ? (
        <Body frame={referenceFrame} color="secondary" size="xs">
          Disponible hasta el {formatFechaCorta(availableUntil)} 🕒
        </Body>
      ) : null}

      {/* Icono decorativo */}
      <View
        style={{
          position: "absolute",
          right: padCard,
          top: 0,
          bottom: 0,
          justifyContent: "center",
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
