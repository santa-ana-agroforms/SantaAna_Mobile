// src/components/atoms/Input.tsx
import { colors } from "@/theme/tokens";
import React, { useMemo, useState } from "react";
import { TextInput, TextInputProps, View, useWindowDimensions } from "react-native";
import Label from "./Label";
import { Caption } from "./Typography";

type Frame = { width: number; height: number };

type Props = TextInputProps & {
  label?: string;
  required?: boolean;
  error?: string;
  /** Recomendado: pásale el referenceFrame del PageScaffold */
  frame?: Frame;
  /** Fuerza estado de enfoque visual (útil si controlas foco afuera) */
  focusedOverride?: boolean;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const Input: React.FC<Props> = ({
  label,
  required,
  error,
  editable = true,
  style,
  frame,
  focusedOverride,
  onFocus,
  onBlur,
  ...rest
}) => {
  // fallback si no pasan frame
  const { width, height } = useWindowDimensions();
  const baseFrame = frame ?? { width, height };

  const [focused, setFocused] = useState(false);
  const isFocused = focusedOverride ?? focused;

  const dims = useMemo(() => {
    const minSide = Math.min(baseFrame.width, baseFrame.height);
    const baseRem = clamp(minSide * 0.042, 14, 18);

    const radius = clamp(minSide * 0.018, 8, 12);
    const padH = clamp(minSide * 0.014, 12, 18);
    const padV = clamp(minSide * 0.01, 8, 14);
    const borderW = 1;

    const labelGap = clamp(minSide * 0.008, 6, 12);
    const errorGap = clamp(minSide * 0.006, 4, 10);

    const fontSize = clamp(baseRem * 1.05, 14, 20);
    const minH = clamp(minSide * 0.06, 44, 62);

    return { radius, padH, padV, borderW, labelGap, errorGap, fontSize, minH };
  }, [baseFrame.height, baseFrame.width]);

  const borderColor = !editable
    ? colors.neutral200
    : error
      ? colors.danger600
      : isFocused
        ? colors.primary600
        : colors.border;

  const bg = editable ? colors.neutral0 : "#F2F2F2";

  return (
    <View style={{ width: "100%" }}>
      <Label frame={frame} text={label} required={required} />
      <View
        style={{
          borderColor,
          borderWidth: dims.borderW,
          borderRadius: dims.radius,
          backgroundColor: bg,
          paddingHorizontal: dims.padH,
          paddingVertical: dims.padV,
          minHeight: dims.minH,
          justifyContent: "center",
        }}
      >
        <TextInput
          {...rest}
          editable={editable}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            {
              fontSize: dims.fontSize,
              fontFamily: "Inter_400Regular",
              color: colors.textPrimary,
              padding: 0,
            },
            style,
          ]}
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      {error ? (
        <Caption
          frame={baseFrame}
          color="primary"
          style={{ color: colors.danger600, marginTop: dims.errorGap }}
        >
          {error}
        </Caption>
      ) : null}
    </View>
  );
};

export default Input;
