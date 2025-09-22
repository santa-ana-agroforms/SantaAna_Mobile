// src/components/atoms/Typography.tsx
import { colors } from "@/theme/tokens";
import React from "react";
import { Text, TextProps, useWindowDimensions } from "react-native";

type Frame = { width: number; height: number };

type BaseProps = TextProps & {
  weight?: "regular" | "medium" | "semibold" | "bold";
  /** Variante semántica mapeada a tokens */
  color?: "primary" | "secondary" | "tertiary" | "inverse";
  /** Escala base (recomendado: referenceFrame del PageScaffold) */
  frame?: Frame;
};

type BodySize = "xs" | "sm" | "md" | "lg" | "xl";
type BodyProps = BaseProps & { size?: BodySize };

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const font = (weight: NonNullable<BaseProps["weight"]>) => {
  switch (weight) {
    case "bold":
      return "Inter_700Bold";
    case "semibold":
      return "Inter_600SemiBold";
    case "medium":
      return "Inter_500Medium";
    default:
      return "Inter_400Regular";
  }
};

/** Base tipográfica derivada del lado menor del frame. */
const getBaseRem = (frame: Frame) => {
  const minSide = Math.min(frame.width, frame.height);
  // ≈16px en ~375 de ancho; acotado para extremos
  return clamp(minSide * 0.042, 14, 18);
};

const bodyFactor: Record<BodySize, number> = {
  xs: 0.95,
  sm: 1.05,
  md: 1.2, // default previo
  lg: 1.35,
  xl: 1.55,
};

const getTokenColor = (variant: NonNullable<BaseProps["color"]>) => {
  switch (variant) {
    case "primary":
      return colors.textPrimary;
    case "secondary":
      return colors.textSecondary;
    case "tertiary":
      return colors.textTertiary;
    case "inverse":
      return colors.neutral0;
  }
};

export const Title: React.FC<BaseProps> = ({
  style,
  weight = "bold",
  color = "primary",
  frame,
  ...rest
}) => {
  const { width, height } = useWindowDimensions();
  const baseRem = getBaseRem(frame ?? { width, height });
  const fontSize = clamp(baseRem * 2.0, 18, 34);

  return (
    <Text
      {...rest}
      style={[
        { fontSize, color: getTokenColor(color), fontFamily: font(weight) },
        style,
      ]}
    />
  );
};

export const Body: React.FC<BodyProps> = ({
  style,
  weight = "regular",
  color = "primary",
  frame,
  size = "md",
  ...rest
}) => {
  const { width, height } = useWindowDimensions();
  const baseRem = getBaseRem(frame ?? { width, height });
  const factor = bodyFactor[size];
  const fontSize = clamp(baseRem * factor, 12, 60);

  return (
    <Text
      {...rest}
      style={[
        { fontSize, color: getTokenColor(color), fontFamily: font(weight) },
        style,
      ]}
    />
  );
};

export const Caption: React.FC<BaseProps> = ({
  style,
  weight = "medium",
  color = "secondary",
  frame,
  ...rest
}) => {
  const { width, height } = useWindowDimensions();
  const baseRem = getBaseRem(frame ?? { width, height });
  const fontSize = clamp(baseRem * 1.1, 12, 24);

  return (
    <Text
      {...rest}
      style={[
        { fontSize, color: getTokenColor(color), fontFamily: font(weight) },
        style,
      ]}
    />
  );
};
