import Button from "@/components/atoms/Button";
import { Body, Title } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import { useFocusEffect } from "@react-navigation/native";
import React, { memo, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
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
  name: string;
  totalForms: number;
  completedForms: number;
  onPress: () => void;
  /** Opcional: precarga (se llama en onPressIn) */
  onPreload?: () => void | Promise<void>;
  referenceFrame: Frame;
  style?: ViewStyle; // el contenedor (grid) define el width y posiciona
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const baseStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    justifyContent: "space-between",
    overflow: "hidden",
  },
});

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CategoryCard: React.FC<Props> = ({
  name,
  totalForms,
  completedForms,
  onPress,
  onPreload,
  referenceFrame,
  style,
}) => {
  // Layout derivado del frame
  const { pad, spacerSm, titleSize } = useMemo(() => {
    const minSide = Math.min(referenceFrame.width, referenceFrame.height);
    const _pad = clamp(minSide * 0.02, 12, 20);
    const _spacerSm = clamp(minSide * 0.008, 6, 12);
    const _titleSize = name.length > 20 ? minSide * 0.04 : minSide * 0.045;
    return { pad: _pad, spacerSm: _spacerSm, titleSize: _titleSize };
  }, [referenceFrame.height, referenceFrame.width, name.length]);

  // -------- Animación de toque (patrón robusto) --------
  const scale = useSharedValue(1);
  const overlay = useSharedValue(0);
  const animatingRef = useRef(false);
  const preloadedRef = useRef(false);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navDelayMs = 160; // tiempo mínimo para ver el “tap”
  const unlockDelayMs = 360; // suelta lock aunque la animación se cancele por navegación

  const springInCfg = { stiffness: 320, damping: 20, mass: 1, overshootClamping: true };
  const springOutCfg = { stiffness: 220, damping: 18, mass: 1, overshootClamping: true };

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: overlay.value * 0.08,
  }));

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

  // Reset robusto cuando esta pantalla vuelve a foco
  useFocusEffect(
    React.useCallback(() => {
      resetAnim();
      return () => resetAnim();
    }, [])
  );

  // Cleanup al desmontar
  useEffect(() => {
    return () => resetAnim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (animatingRef.current) return; // si ya está en la secuencia de press, no interferir
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

    // Fallback: liberar lock aunque la animación se cancele por navegación
    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = setTimeout(() => {
      animatingRef.current = false;
      preloadedRef.current = false;
    }, unlockDelayMs);

    // Navegar tras un delay fijo (no dependemos de callback del spring)
    if (onPress) {
      setTimeout(() => {
        animatingRef.current = false; // por si el usuario vuelve muy rápido
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
      style={[baseStyles.card, { padding: pad }, animatedCardStyle, style]}
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
          },
          animatedOverlayStyle,
        ]}
      />

      <Title
        style={{
          fontSize: titleSize,
          textAlign: "center",
          color: colors.textTertiary,
        }}
      >
        {name}
      </Title>

      <View style={{ paddingVertical: spacerSm }}>
        <Body color="secondary" size="xs">
          Formularios: {totalForms}
        </Body>
        <Body color="secondary" size="xs">
          Completados: {completedForms}
        </Body>
      </View>

      {/* Botón visible: mantiene el mismo feedback de tap que la card */}
      <Button
        title="INGRESAR"
        size="lg"
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      />
    </AnimatedPressable>
  );
};

export default memo(CategoryCard);
