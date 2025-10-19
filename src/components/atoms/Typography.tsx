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

type BodySize = "xxs" | "xs" | "sm" | "md" | "lg" | "xl";
type BodyProps = BaseProps & { size?: BodySize };

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
  return minSide * 0.042;
};

const bodyFactor: Record<BodySize, number> = {
  xxs: 0.7,
  xs: 0.85,
  sm: 0.9,
  md: 1.1, // default previo
  lg: 1.25,
  xl: 1.3,
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
  const fontSize = baseRem * 1.0;

  return (
    <Text
      {...rest}
      allowFontScaling={false}
      style={[{ fontSize, color: getTokenColor(color), fontFamily: font(weight) }, style]}
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
  const fontSize = baseRem * factor;

  return (
    <Text
      {...rest}
      allowFontScaling={false}
      style={[{ fontSize, color: getTokenColor(color), fontFamily: font(weight) }, style]}
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
  const fontSize = baseRem * 1.1;

  return (
    <Text
      {...rest}
      allowFontScaling={false}
      style={[{ fontSize, color: getTokenColor(color), fontFamily: font(weight) }, style]}
    />
  );
};
