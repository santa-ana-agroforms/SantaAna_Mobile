// src/components/atoms/SkeletonLoader.tsx
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, I18nManager, StyleProp, StyleSheet, View, ViewStyle } from "react-native";

export type Frame = { width: number; height: number };

type Preset = "custom" | "text" | "title" | "button" | "card" | "avatar" | "listItem";

export type SkeletonLoaderProps = {
  ready?: boolean;
  children?: React.ReactNode;

  frame?: Frame; // ← usa SIEMPRE esto para escalar (viene del PageScaffold)

  preset?: Preset;

  // "custom"
  width?: number | string;
  height?: number | string;
  radius?: number;
  circular?: boolean;

  // "text"
  lines?: number;
  lineHeight?: number;
  gap?: number;
  lastLineWidthPct?: number;

  // "listItem"
  count?: number;
  itemGap?: number;

  // animación
  duration?: number;
  paused?: boolean;

  // estilos/colores
  style?: StyleProp<ViewStyle>;
  colors?: [string, string, string]; // [fondo, brillo, fondo]
};

const BaseSkeleton: React.FC<{
  width: number | string;
  height: number | string;
  radius?: number;
  circular?: boolean;
  duration: number;
  paused?: boolean;
  colors: [string, string, string]; // no obligatorio ya; usamos un highlight blanco
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}> = ({
  width,
  height,
  radius = 8,
  circular,
  duration,
  paused,
  colors,
  style,
  accessibilityLabel = "Cargando",
}) => {
  const progress = useRef(new Animated.Value(0)).current;
  const [size, setSize] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const isRTL = I18nManager.isRTL;

  // arranca/reinicia animación al conocer el tamaño
  useEffect(() => {
    if (!size.w || paused) return;
    progress.stopAnimation();
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: Math.max(600, duration - 200),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [size.w, duration, paused, progress]);

  // radio
  const computedRadius =
    circular && typeof height === "number" ? height / 2 : circular ? 9999 : radius;

  // base clara + highlight (blanco) con alpha
  const baseBg = colors?.[0] ?? "#F1F0EB";
  const gradientColors: [
    import("react-native").ColorValue,
    import("react-native").ColorValue,
    import("react-native").ColorValue,
  ] = ["rgba(255,255,255,0.0)", "rgba(255,255,255,0.9)", "rgba(255,255,255,0.0)"];

  // ancho de la banda de brillo (≈35% del ancho disponible)
  const bandWidth = Math.max(1, size.w * 0.35);
  // la banda recorre desde -bandWidth hasta w (sale por ambos lados)
  const startX = -bandWidth;
  const endX = size.w;
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: isRTL ? [endX, startX] : [startX, endX],
  });

  return (
    <View
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (w !== size.w || h !== size.h) setSize({ w, h });
      }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          overflow: "hidden",
          borderRadius: computedRadius,
          width: width as import("react-native").DimensionValue,
          height: height as import("react-native").DimensionValue,
          backgroundColor: baseBg,
        },
        style,
      ]}
    >
      {/* Franja de shimmer más angosta que se desplaza a lo largo */}
      {size.w > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: -size.h * 0.25, // más alto para cubrir al rotar
              height: size.h * 1.5,
              width: bandWidth,
              transform: [
                { translateX },
                { rotateZ: "15deg" }, // leve inclinación para más visibilidad
              ],
            },
          ]}
        >
          <LinearGradient
            colors={gradientColors}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      )}
    </View>
  );
};

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  ready = false,
  children,
  frame,

  preset = "custom",

  // custom
  width,
  height,
  radius = 10,
  circular = false,

  // text
  lines = 3,
  lineHeight = 14,
  gap = 8,
  lastLineWidthPct = 60,

  // listItem
  count = 6,
  itemGap = 16,

  duration = 1200,
  paused = false,

  style,
  colors,
}) => {
  // paleta por defecto (alineada a #F9F6EE en claro)
  const palette: [string, string, string] = useMemo(() => {
    return colors ?? ["#E9E7E1", "#F3F1EB", "#E9E7E1"];
  }, [colors]);

  if (ready) {
    return <>{children}</>;
  }

  // escala basada SOLO en frame
  const minSide = Math.min(frame?.width ?? 360, frame?.height ?? 640);

  // Presets calculados SOLAMENTE con proporciones del frame (sin clamp)
  if (preset === "text") {
    return (
      <View style={style}>
        {Array.from({ length: lines }).map((_, i) => {
          const isLast = i === lines - 1;
          const w = isLast ? `${lastLineWidthPct}%` : "100%";
          return (
            <View key={i} style={{ marginBottom: i < lines - 1 ? gap : 0 }}>
              <BaseSkeleton
                width={w}
                height={lineHeight}
                radius={6}
                duration={duration}
                paused={paused}
                colors={palette}
              />
            </View>
          );
        })}
      </View>
    );
  }

  if (preset === "title") {
    // ~3% del lado menor
    const h = minSide * 0.03;
    return (
      <BaseSkeleton
        width="80%"
        height={h}
        radius={8}
        duration={duration}
        paused={paused}
        colors={palette}
        style={style}
      />
    );
  }

  if (preset === "button") {
    // Altura proporcional al frame (toma tu patrón)
    const h = minSide * 0.08; // misma proporción que usas en Button
    const r = h * 0.22; // radio proporcional (sin límites)
    return (
      <BaseSkeleton
        width="50%"
        height={h}
        radius={r}
        duration={duration}
        paused={paused}
        colors={palette}
        style={style}
      />
    );
  }

  if (preset === "card") {
    // Tarjeta grande relativa al frame
    const h = minSide * 0.22;
    return (
      <BaseSkeleton
        width="100%"
        height={h}
        radius={12}
        duration={duration}
        paused={paused}
        colors={palette}
        style={style}
      />
    );
  }

  if (preset === "avatar") {
    const size = minSide * 0.12;
    return (
      <BaseSkeleton
        width={size}
        height={size}
        circular
        duration={duration}
        paused={paused}
        colors={palette}
        style={style}
      />
    );
  }

  if (preset === "listItem") {
    const avatarSize = minSide * 0.12;
    const txtH = minSide * 0.018;
    const gapH = minSide * 0.01;

    return (
      <View style={style}>
        {Array.from({ length: count }).map((_, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: i < count - 1 ? itemGap : 0,
            }}
          >
            <BaseSkeleton
              width={avatarSize}
              height={avatarSize}
              circular
              duration={duration}
              paused={paused}
              colors={palette}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <BaseSkeleton
                width="70%"
                height={txtH}
                radius={6}
                duration={duration}
                paused={paused}
                colors={palette}
              />
              <View style={{ height: gapH }} />
              <BaseSkeleton
                width="40%"
                height={txtH}
                radius={6}
                duration={duration}
                paused={paused}
                colors={palette}
              />
            </View>
          </View>
        ))}
      </View>
    );
  }

  // preset === "custom"
  return (
    <BaseSkeleton
      width={width ?? "100%"}
      height={height ?? 16}
      radius={radius}
      circular={circular}
      duration={duration}
      paused={paused}
      colors={palette}
      style={style}
    />
  );
};

export default React.memo(SkeletonLoader);
