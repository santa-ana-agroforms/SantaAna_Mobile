// src/components/atoms/Input.tsx
import { colors } from "@/theme/tokens";
import React, { useMemo, useState } from "react";
import { Platform, TextInput, TextInputProps, View, useWindowDimensions } from "react-native";
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
  onChangeText,
  value,
  ...rest
}) => {
  // fallback si no pasan frame
  const { width, height } = useWindowDimensions();
  const baseFrame = frame ?? { width, height };

  const [focused, setFocused] = useState(false);
  const [uncontrolledText, setUncontrolledText] = useState("");
  const [contentHeight, setContentHeight] = useState(0);

  const isFocused = focusedOverride ?? focused;
  const textValue = value ?? uncontrolledText;

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
    const lineH = Math.round(fontSize * 1.25);

    const minH = Math.max(44, padV * 2 + lineH);

    return { radius, padH, padV, borderW, labelGap, errorGap, fontSize, lineH, minH };
  }, [baseFrame.height, baseFrame.width]);

  const borderColor = !editable
    ? colors.neutral200
    : error
      ? colors.danger600
      : isFocused
        ? colors.primary600
        : colors.border;

  const bg = editable ? colors.neutral0 : "#F2F2F2";

  const handleContentSizeChange = (e: any) => {
    const h = e?.nativeEvent?.contentSize?.height ?? 0;
    if (h > 0) {
      const fix = Platform.OS === "android" ? 1 : 0;
      setContentHeight(Math.max(dims.lineH, Math.ceil(h) - fix));
    }
  };

  const handleChangeText = (t: string) => {
    if (value === undefined) setUncontrolledText(t);
    onChangeText?.(t);
  };

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
          multiline
          scrollEnabled={false}
          value={textValue}
          onChangeText={handleChangeText}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          onContentSizeChange={handleContentSizeChange}
          style={[
            {
              fontSize: dims.fontSize,
              lineHeight: dims.lineH,
              fontFamily: "Inter_400Regular",
              color: colors.textPrimary,
              padding: 0,
              textAlignVertical: "top",
              height: Math.max(dims.lineH, contentHeight || dims.lineH),
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
