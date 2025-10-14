import { useResponsive } from "@/hooks/useResponsive";
import { colors } from "@/theme/tokens";
import React, { useEffect, useMemo } from "react";
import { I18nManager, Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

type Props = {
  /** número total de páginas */
  total: number;
  /** índice activo 0-based */
  activeIndex: number;
  /** callback al cambiar (por flecha o dot) con índice 0-based */
  onChange: (newIndex: number) => void;
  /** muestra flechas integradas */
  arrows?: boolean;
  /** tamaño base del dot (px) */
  size?: number;
  /** separación entre dots (px) */
  gap?: number;
  /** indicador tipo “pill” (ligeramente más ancho que un dot) */
  pill?: boolean;
  /** deshabilitar interacción con dots (sólo flechas) */
  disableDotPress?: boolean;
};

const ArrowBtn: React.FC<{
  label: "‹" | "›";
  disabled?: boolean;
  onPress?: () => void;
  size: number;
  fontSize: number;
}> = ({ label, disabled, onPress, size, fontSize }) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pressIn = () => {
    if (disabled) return;
    scale.value = withSpring(0.94, { stiffness: 320, damping: 20, mass: 0.9 });
  };
  const pressOut = () => {
    if (disabled) return;
    scale.value = withSpring(1, { stiffness: 260, damping: 20, mass: 0.9 });
  };
  const press = () => {
    if (disabled) return;
    scale.value = withTiming(0.9, { duration: 70 }, () => {
      scale.value = withSpring(1);
    });
    onPress?.();
  };

  return (
    <Animated.View style={[{ width: size, height: size, borderRadius: 999 }, animStyle]}>
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={press}
        disabled={disabled}
        accessibilityRole="button"
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: disabled ? colors.neutral200 : colors.primary600,
          borderWidth: 1,
          borderColor: disabled ? colors.neutral200 : colors.primary600,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Animated.Text
          style={{
            fontSize,
            color: disabled ? "colors.textPrimary" : colors.surface,
            lineHeight: fontSize,
            marginTop: -fontSize * 0.06,
          }}
        >
          {label}
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
};

const PaginationDots: React.FC<Props> = ({
  total,
  activeIndex,
  onChange,
  arrows = true,
  size,
  gap,
  pill = true,
  disableDotPress = false,
}) => {
  const { rem } = useResponsive();
  const dot = size ?? Math.round(rem * 1); // ~8–10px
  const spacing = gap ?? Math.round(rem * 1); // ~8–10px
  const arrowSize = dot * 3.1;
  const arrowFont = Math.max(14, Math.min(28, arrowSize * 0.78));

  const clampedActive = Math.max(0, Math.min(total - 1, activeIndex));
  const isFirst = clampedActive <= 0;
  const isLast = clampedActive >= total - 1;
  const rtl = I18nManager.isRTL;

  const trackWidth = useMemo(
    () => total * dot + Math.max(0, total - 1) * spacing,
    [total, dot, spacing]
  );

  // Animación principal: índice como valor continuo (permite “worm”)
  const progress = useSharedValue(clampedActive);
  const bounceY = useSharedValue(1);

  useEffect(() => {
    // rebote vertical sutil
    bounceY.value = withTiming(0.9, { duration: 90, easing: Easing.out(Easing.cubic) }, () => {
      bounceY.value = withSpring(1, { stiffness: 260, damping: 16 });
    });
    // transición suave entre índices
    progress.value = withTiming(clampedActive, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [clampedActive, progress, bounceY]);

  // Derivados animados para el indicador
  const indicatorStyle = useAnimatedStyle(() => {
    // posición base
    const baseX = progress.value * (dot + spacing);
    const translateX = rtl ? trackWidth - dot - baseX : baseX;

    // factor "worm": 0→1→0 durante el salto entre puntos
    const frac = Math.abs(progress.value - Math.round(progress.value));
    const worm = pill ? 1 - Math.abs(0.5 - frac) * 2 : 0; // triangular

    // ancho variable: desde dot hasta dot + (dot+spacing) * 0.9
    const extra = pill ? (dot + spacing) * 0.9 * worm : 0;
    const width = dot + extra;

    return {
      transform: [{ translateX }, { scaleY: bounceY.value }],
      width,
    };
  });

  // Opacidad de dots (el activo se hace “hueco” para que se vea el indicador debajo)
  const dotOpacity = useDerivedValue(() =>
    withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) })
  );

  const goPrev = () => onChange(Math.max(0, clampedActive - 1));
  const goNext = () => onChange(Math.min(total - 1, clampedActive + 1));

  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", columnGap: spacing }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`Paginación, página ${clampedActive + 1} de ${total}`}
    >
      {arrows && (
        <ArrowBtn
          label={rtl ? "›" : "‹"}
          size={arrowSize}
          fontSize={arrowFont}
          disabled={isFirst}
          onPress={goPrev}
        />
      )}

      {/* Track */}
      <View
        style={{
          width: trackWidth,
          height: dot,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* línea base sutil */}
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: Math.max(2, dot * 0.24),
            borderRadius: 999,
            backgroundColor: colors.neutral200,
          }}
        />

        {/* dots */}
        <View style={{ flexDirection: "row", columnGap: spacing }}>
          {Array.from({ length: total }).map((_, i) => {
            const isActive = i === clampedActive;
            return (
              <Pressable
                key={i}
                disabled={disableDotPress}
                onPress={disableDotPress ? undefined : () => onChange(i)}
                accessibilityRole={disableDotPress ? undefined : "button"}
                accessibilityLabel={`Ir a la página ${i + 1}`}
                hitSlop={10}
                style={{
                  width: dot,
                  height: dot,
                  borderRadius: dot / 2,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Animated.View
                  style={{
                    width: dot,
                    height: dot,
                    borderRadius: dot / 2,
                    backgroundColor: isActive ? "transparent" : colors.neutral200,
                    opacity: isActive ? 1 : (dotOpacity.value as unknown as number),
                  }}
                />
              </Pressable>
            );
          })}
        </View>

        {/* indicador animado */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 0,
              top: 0,
              height: dot,
              borderRadius: dot,
              backgroundColor: colors.textPrimary, // contraste minimalista
            },
            indicatorStyle,
          ]}
        />
      </View>

      {arrows && (
        <ArrowBtn
          label={rtl ? "‹" : "›"}
          size={arrowSize}
          fontSize={arrowFont}
          disabled={isLast}
          onPress={goNext}
        />
      )}
    </View>
  );
};

export default PaginationDots;
