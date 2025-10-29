// src/components/atoms/Button.tsx
import { ButtonSize, ButtonVariant, colors } from "@/theme/tokens";
import React, { useMemo } from "react";
import {
  GestureResponderEvent,
  Pressable,
  TextStyle,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import { Body } from "./Typography";

type Frame = { width: number; height: number };

type Props = {
  title: string;
  onPress?: (e: GestureResponderEvent) => void;
  variant?: ButtonVariant; // "primary" | "ghost" | "danger" (según tus tokens)
  size?: ButtonSize; // "sm" | "md" | "lg" (según tus tokens)
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  /**
   * Frame base para escalar internamente (recomendado: referenceFrame).
   * Si no se pasa, el botón usa useWindowDimensions() como fallback.
   */
  onPressIn?: (e: GestureResponderEvent) => void;
  onPressOut?: (e: GestureResponderEvent) => void;
  frame?: Frame;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const Button: React.FC<Props> = ({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  style,
  onPressIn = () => {},
  textStyle,
  onPressOut = () => {},
  frame,
}) => {
  const { width: ww, height: hh } = useWindowDimensions();
  const baseFrame = frame ?? { width: ww, height: hh };

  // Todas las métricas internas se derivan del lado menor del referenceFrame
  const { heightPx, radius, padH, fontSize } = useMemo(() => {
    const minSide = Math.min(baseFrame.width, baseFrame.height);

    // Alturas por tamaño (accesibles y proporcionales)
    const hSm = minSide * 0.08;
    const hMd = minSide * 0.1;
    const hLg = minSide * 0.12;
    const _height = size === "sm" ? hSm : size === "lg" ? hLg : hMd;

    // Radio y padding proporcionales a la altura (con límites)
    const _radius = clamp(_height * 0.22, 8, 14);
    const _padH = clamp(_height * 0.6, 12, 24);

    // Tipografía basada en la altura del botón (legible y consistente)
    const _fontSize = _height * 0.32;

    return {
      heightPx: _height,
      radius: _radius,
      padH: _padH,
      fontSize: _fontSize,
    };
  }, [baseFrame.height, baseFrame.width, size]);

  let bg = colors.primary600;
  let borderColor: string | undefined = "transparent";
  let borderWidth = 0;
  const opacity = disabled ? 0.6 : 1;

  if (variant === "ghost") {
    bg = "transparent";
    borderColor = colors.primary600;
    borderWidth = 1;
  } else if (variant === "danger") {
    bg = colors.danger600;
  }

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      android_ripple={{ color: "rgba(0,0,0,0.08)" }}
      style={[
        {
          height: heightPx,
          borderRadius: radius,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
          opacity,
          borderColor,
          borderWidth,
          paddingHorizontal: padH,
        },
        style,
      ]}
    >
      <Body
        weight="bold"
        color={variant === "ghost" ? "primary" : "inverse"}
        style={[{ fontSize }, textStyle]}
      >
        {title}
      </Body>
    </Pressable>
  );
};

export default Button;
