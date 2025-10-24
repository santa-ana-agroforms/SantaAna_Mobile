// src/components/atoms/Input.tsx
import { colors } from "@/theme/tokens";
import React, { useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  NativeSyntheticEvent,
  Platform,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  TextInputProps,
  View,
  useWindowDimensions,
} from "react-native";
import Label from "./Label";
import { Caption } from "./Typography";

type Frame = { width: number; height: number };

type Props = TextInputProps & {
  label?: string;
  required?: boolean;
  error?: string;
  frame?: Frame;
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
  placeholder,
  onKeyPress,
  onSubmitEditing,
  returnKeyType,
  blurOnSubmit,
  multiline = true, // mantenemos multiline para autoaltura
  ...rest
}) => {
  const { width, height } = useWindowDimensions();
  const baseFrame = frame ?? { width, height };

  const [focused, setFocused] = useState(false);
  const [uncontrolledText, setUncontrolledText] = useState("");
  const [measuredHeight, setMeasuredHeight] = useState(0);

  const [containerWidth, setContainerWidth] = useState(0);
  const [innerWidth, setInnerWidth] = useState(0);

  const isFocused = focusedOverride ?? focused;
  const textValue = value ?? uncontrolledText;
  const displayText = (textValue?.length ?? 0) > 0 ? textValue : (placeholder ?? " ");

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

  const handleContainerLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== containerWidth) {
      setContainerWidth(w);
      setInnerWidth(Math.max(0, w - dims.padH * 2));
    }
  };

  const textStyleBase = useMemo(
    () => ({
      fontSize: dims.fontSize,
      lineHeight: dims.lineH,
      fontFamily: "Inter_400Regular" as const,
    }),
    [dims.fontSize, dims.lineH]
  );

  // ====== Helpers de commit ======
  // Ajuste dentro del Input.tsx
  const commit = (raw: string) => {
    // Evita newlines finales
    const next = raw.replace(/[\r\n]+$/, "").trim();

    // Si está vacío, consideramos que no hay valor
    const finalValue = next.length === 0 ? null : next;

    if (value === undefined && (finalValue ?? "") !== uncontrolledText) {
      setUncontrolledText(finalValue ?? "");
    }

    onChangeText?.(finalValue as any); // ahora puede ser string o null
  };

  const handleChangeText = (t: string) => {
    if (value === undefined) setUncontrolledText(t);
    // seguimos notificando en cada cambio (si tu parent quiere live-update)
    onChangeText?.(t);
  };

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    // Llama también al onKeyPress del caller si lo pasó
    onKeyPress?.(e);
    if (e.nativeEvent.key === "Enter") {
      // En web podríamos evitar salto; en nativo RN no hay preventDefault para TextInput
      if (Platform.OS === "web") {
        // @ts-ignore
        e.preventDefault?.();
      }
      commit(textValue ?? "");
    }
  };

  const handleSubmitEditing = () => {
    // iOS/Android disparan esto si blurOnSubmit=true (incluso con multiline en versiones recientes)
    onSubmitEditing?.({} as any);
    commit(textValue ?? "");
  };

  const handleBlur = (ev: any) => {
    setFocused(false);
    // Commit on blur
    commit(textValue ?? "");
    onBlur?.(ev);
  };

  const Measure = (
    <View
      style={{
        position: "absolute",
        left: -9999,
        top: -9999,
        width: innerWidth || 0,
        opacity: 0,
        pointerEvents: "none",
      }}
      key={`${innerWidth}-${displayText.length}-${dims.fontSize}-${dims.lineH}`}
    >
      <Text
        allowFontScaling={false}
        onLayout={(ev) => {
          const h = ev.nativeEvent.layout.height;
          if (h > 0) {
            const fix = Platform.OS === "android" ? 1 : 0;
            setMeasuredHeight(Math.max(dims.lineH, Math.ceil(h) - fix));
          } else {
            setMeasuredHeight(dims.lineH);
          }
        }}
        style={[
          textStyleBase,
          {
            flexWrap: "wrap",
          },
        ]}
      >
        {displayText || " "}
      </Text>
    </View>
  );

  return (
    <View style={{ width: "100%" }}>
      <Label frame={frame} text={label} required={required} />

      <View
        onLayout={handleContainerLayout}
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
        {Measure}
        <TextInput
          allowFontScaling={false}
          {...rest}
          editable={editable}
          multiline={multiline}
          scrollEnabled={false}
          value={textValue}
          onChangeText={handleChangeText}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={handleBlur}
          onKeyPress={handleKeyPress}
          onSubmitEditing={handleSubmitEditing}
          // Para garantizar onSubmitEditing en iOS/Android con multiline
          blurOnSubmit={blurOnSubmit ?? true}
          returnKeyType={returnKeyType ?? "done"}
          style={[
            {
              ...textStyleBase,
              color: colors.textPrimary,
              padding: 0,
              textAlignVertical: "top",
              height: Math.max(dims.lineH, measuredHeight || dims.lineH),
              width: innerWidth || undefined,
            },
            style,
          ]}
          placeholder={placeholder}
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
