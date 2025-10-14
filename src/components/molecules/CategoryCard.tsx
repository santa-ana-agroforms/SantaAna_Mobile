import Button from "@/components/atoms/Button";
import { Body, Title } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

type Frame = { width: number; height: number };

type Props = {
  name: string;
  totalForms: number;
  completedForms: number;
  onPress: () => void;
  onPreload?: () => void | Promise<void>;
  referenceFrame: Frame;
  style?: ViewStyle;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const baseStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#000",
    zIndex: 10, // iOS
    elevation: 10, // Android
  },
});

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Arco del ancho disponible, poco profundo (sin ocupar mucha altura) */
const ArcDivider: React.FC<{
  width: number;
  thickness: number;
  depth: number;
  track?: string;
  fill?: string;
  ratio?: number;
}> = ({
  width,
  thickness,
  depth,
  track = "#EEF2F1",
  fill = colors.primary600 ?? "#2D8A24",
  ratio = 1,
}) => {
  // Arco "sonrisa" bajo el título (cóncavo hacia arriba)
  const h = depth + thickness;
  const pathD = `M 0 ${depth + thickness / 2} Q ${width / 2} ${thickness / 2} ${width} ${depth + thickness / 2}`;

  const progressW = useSharedValue(0);
  useEffect(() => {
    progressW.value = withTiming(width * ratio, { duration: 380 });
  }, [ratio, width, progressW]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: Math.max(0, progressW.value),
  }));

  return (
    <View style={{ width, height: h }}>
      <Svg width={width} height={h}>
        <Path d={pathD} stroke={track} strokeWidth={thickness} fill="none" strokeLinecap="round" />
      </Svg>
      <Animated.View
        style={[
          { position: "absolute", top: 0, left: 0, height: h, overflow: "hidden" },
          animatedStyle,
        ]}
      >
        <Svg width={width} height={h}>
          <Path d={pathD} stroke={fill} strokeWidth={thickness} fill="none" strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </View>
  );
};

const CategoryCard: React.FC<Props> = ({
  name,
  totalForms,
  completedForms,
  onPress,
  onPreload,
  referenceFrame,
  style,
}) => {
  // Layout responsivo (sin forzar height)
  const { pad, gap, titleSize, arcThickness, arcDepth, chipPadH, chipPadV } = useMemo(() => {
    const minSide = Math.min(referenceFrame.width, referenceFrame.height);

    const pad = clamp(minSide * 0.02, 12, 18);
    const gap = clamp(minSide * 0.012, 8, 12);
    const titleSize =
      name.length > 20 ? clamp(minSide * 0.04, 16, 20) : clamp(minSide * 0.045, 18, 22);

    const arcThickness = clamp(minSide * 0.04, 6, 10);
    const arcDepth = clamp(minSide * 0.1, 16, 28);

    const chipPadH = clamp(minSide * 0.02, 10, 14);
    const chipPadV = clamp(minSide * 0.012, 6, 9);

    return { pad, gap, titleSize, arcThickness, arcDepth, chipPadH, chipPadV };
  }, [referenceFrame, name.length]);

  // Ancho REAL del card (edge-to-edge)
  const [cardW, setCardW] = useState(0);

  // Animaciones de tap + bloqueo robusto
  const scale = useSharedValue(1);
  const overlay = useSharedValue(0);
  const animatingRef = useRef(false);
  const preloadedRef = useRef(false);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navDelayMs = 160;
  const unlockDelayMs = 360;

  const springInCfg = { stiffness: 320, damping: 20, mass: 1, overshootClamping: true };
  const springOutCfg = { stiffness: 220, damping: 18, mass: 1, overshootClamping: true };

  const animCard = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const animOverlay = useAnimatedStyle(() => ({ opacity: overlay.value * 0.14 }));

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
    if (animatingRef.current) return; // si ya vamos a navegar, no hacer bounce
    overlay.value = withTiming(0, { duration: 140 });
    scale.value = withSpring(1, springOutCfg);
  };

  const handlePress = () => {
    if (animatingRef.current) return;
    animatingRef.current = true;

    // Squish + overlay
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

    // Navegar tras un delay fijo (no dependemos del callback del spring)
    setTimeout(() => {
      animatingRef.current = false; // ← liberar lock ANTES de navegar
      preloadedRef.current = false;
      runOnJS(onPress)();
    }, navDelayMs);
  };

  // Datos
  const safeTotal = Math.max(0, totalForms);
  const safeCompleted = clamp(completedForms, 0, safeTotal);
  const ratio = safeTotal === 0 ? 0 : safeCompleted / safeTotal;
  const statusColor =
    safeTotal === 0
      ? colors.neutral200
      : safeCompleted === safeTotal
        ? (colors.primary600 ?? "#2D8A24")
        : (colors.primary600 ?? "#2D8A24");

  return (
    <AnimatedPressable
      onLayout={(e) => setCardW(e.nativeEvent.layout.width)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[baseStyles.card, animCard, style]}
      accessibilityRole="button"
      accessibilityLabel={`${name}. Progreso ${Math.round(ratio * 100)}%. ${safeCompleted} de ${safeTotal} completados.`}
    >
      {/* Contenido con padding */}
      <View style={{ flex: 1, padding: pad }}>
        {/* Título (mismo color y completo) */}
        <Title style={{ fontSize: titleSize, textAlign: "center", color: colors.textTertiary }}>
          {name}
        </Title>

        {/* Empuja el resto al fondo */}
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <View>
            {/* ARCO edge-to-edge — compensa padding con márgenes negativos */}
            {cardW > 0 && (
              <View style={{ marginTop: -gap * 0.8, marginHorizontal: -pad }}>
                <ArcDivider
                  width={cardW}
                  thickness={arcThickness}
                  depth={arcDepth}
                  track={colors.neutral200}
                  fill={statusColor}
                  ratio={ratio}
                />
              </View>
            )}

            {/* Label “Formularios” */}
            <View style={{ marginTop: -gap * 0.5, alignItems: "center" }}>
              <Body size="xs" color="secondary">
                Formularios
              </Body>
            </View>

            {/* CHIP */}
            <View
              style={{
                alignSelf: "center",
                marginTop: 5,
                borderRadius: 10,
                backgroundColor: "#F6FBF9",
                borderWidth: 1,
                borderColor: "#E8F2EC",
                paddingHorizontal: chipPadH,
                paddingVertical: chipPadV,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                ...(Platform.OS === "android"
                  ? { elevation: 1 }
                  : { shadowOpacity: 0.05, shadowRadius: 2 }),
              }}
              accessible
              accessibilityLabel={`Completados ${safeCompleted} de ${safeTotal}`}
            >
              <View
                style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: statusColor }}
              />
              <Body size="xs" color="secondary">
                {safeCompleted}/{safeTotal} ({Math.round(ratio * 100)}%)
              </Body>
            </View>

            {/* CTA pegado al bottom con el mismo gap */}
            <View style={{ marginTop: gap * 1.5 }}>
              <Button
                title="REVISAR"
                size="md"
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Overlay de oscurecimiento — encima de todo */}
      <Animated.View pointerEvents="none" style={[baseStyles.scrim, animOverlay]} />
    </AnimatedPressable>
  );
};

export default memo(CategoryCard);
