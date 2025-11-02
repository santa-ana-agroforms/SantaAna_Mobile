// src/components/atoms/IconButton.tsx
import { colors } from "@/theme/tokens";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Shadow } from "react-native-shadow-2";

type Frame = { width: number; height: number };

type Props = {
  icon?: React.ReactElement;
  iconSource?: ImageSourcePropType;
  onPress?: () => void;
  /** Se dispara en onPressIn para precargar recursos/datos si quieres */
  onPreload?: () => void | Promise<void>;
  /** Tamaño externo del botón (px). Si no se pasa, se calcula desde frame. */
  size?: number;
  /** Tamaño del ícono interno (px). Si no se pasa, se deriva del size final. */
  iconSize?: number;
  bgColor?: string;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  /** Recomendado: pásale el frame del contenedor (PageScaffold / Header) */
  frame?: Frame;
  showShadow?: boolean;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const baseStyles = StyleSheet.create({
  root: {
    position: "relative",
  },
  pressableFill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
});

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const IconButton: React.FC<Props> = ({
  icon,
  iconSource,
  onPress,
  onPreload,
  size,
  iconSize,
  bgColor = colors.primary600,
  disabled = false,
  style,
  accessibilityLabel,
  frame,
  showShadow = true,
}) => {
  // Sizing
  const { width: ww, height: hh } = useWindowDimensions();
  const baseFrame = frame ?? { width: ww, height: hh };

  const { finalSize, radius, innerIconSize } = useMemo(() => {
    const minSide = Math.min(baseFrame.width, baseFrame.height);
    const autoSize = minSide * 0.11;
    const _size = size ?? autoSize;
    const _radius = clamp(_size * 0.22, 8, 14);
    const autoIcon = _size * 0.8;
    const _iconSize = iconSize ?? autoIcon;
    return { finalSize: _size, radius: _radius, innerIconSize: _iconSize };
  }, [baseFrame.height, baseFrame.width, size, iconSize]);

  // Animación
  const scale = useSharedValue(1);
  const overlay = useSharedValue(0);
  const animatingRef = useRef(false);
  const preloadedRef = useRef(false);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timings y springs
  const navDelayMs = 120; // deja ver el tap antes de navegar
  const unlockDelayMs = 300;
  const springInCfg = { stiffness: 320, damping: 20, mass: 1, overshootClamping: true };
  const springOutCfg = { stiffness: 220, damping: 18, mass: 1, overshootClamping: true };

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: overlay.value * 0.08,
  }));

  const renderIcon = () =>
    iconSource ? (
      <Image
        source={iconSource}
        style={{ width: innerIconSize, height: innerIconSize, resizeMode: "contain" }}
      />
    ) : (
      (icon ?? null)
    );

  const resetAnim = () => {
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
  };

  useEffect(() => {
    return () => resetAnim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePressIn = () => {
    if (disabled) return;
    if (!preloadedRef.current && onPreload) {
      preloadedRef.current = true;
      try {
        onPreload();
      } catch {}
    }
    overlay.value = withTiming(1, { duration: 90 });
    scale.value = withSpring(0.94, springInCfg);
  };

  const handlePressOut = () => {
    if (disabled) return;
    if (animatingRef.current) return; // si ya disparamos onPress, no interferir
    overlay.value = withTiming(0, { duration: 140 });
    scale.value = withSpring(1, springOutCfg);
  };

  const handlePress = () => {
    if (disabled || animatingRef.current) return;
    animatingRef.current = true;

    // “tap” marcado y rebote
    overlay.value = withTiming(1, { duration: 60 });
    scale.value = withSpring(0.9, springInCfg, () => {
      scale.value = withSpring(1, springOutCfg);
    });
    overlay.value = withTiming(0, { duration: 220 });

    // Fallback de desbloqueo por si la navegación cancela animaciones
    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = setTimeout(() => {
      animatingRef.current = false;
      preloadedRef.current = false;
    }, unlockDelayMs);

    // Navegar tras pequeña espera (no dependemos del callback del spring)
    if (onPress) {
      setTimeout(() => {
        animatingRef.current = false;
        preloadedRef.current = false;
        runOnJS(onPress)();
      }, navDelayMs);
    }
  };

  return (
    <View style={[baseStyles.root, { width: finalSize, height: finalSize }, style]}>
      {/* Sombra */}
      {showShadow && (
        <Shadow
          distance={3}
          offset={[0, 6]}
          startColor="#00000029"
          endColor="#00000000"
          style={{ borderRadius: radius }}
        >
          <View
            style={{
              width: finalSize,
              height: finalSize * 0.9,
              borderRadius: radius,
              backgroundColor: "transparent",
            }}
          />
        </Shadow>
      )}

      {/* Botón animado */}
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled}
        android_ripple={{ color: "rgba(0,0,0,0.08)" }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[
          baseStyles.pressableFill,
          { borderRadius: radius, backgroundColor: bgColor, overflow: "hidden" },
          animatedCardStyle,
        ]}
      >
        {/* Overlay sutil */}
        <Animated.View style={[baseStyles.overlayFill, animatedOverlayStyle]} />

        {renderIcon()}
      </AnimatedPressable>
    </View>
  );
};

export default IconButton;
