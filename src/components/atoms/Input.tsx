// src/components/atoms/Input.tsx (extracto relevante y listo para pegar)
import { colors } from "@/theme/tokens";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  Text,
  TextInput,
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
  onCommitValue?: (v: string | null) => void;

  // === NUEVO ===
  variant?: "text" | "password";
  toggleLabels?: { show: string; hide: string };
  /** Renderiza tu propio botón (ícono, etc.) */
  renderPasswordToggle?: (visible: boolean) => React.ReactNode;
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
  value,
  onChangeText,
  onCommitValue,
  onFocus,
  onBlur,
  onKeyPress,
  onSubmitEditing,
  blurOnSubmit,
  returnKeyType,
  placeholder,
  multiline = true,
  // === NUEVO ===
  variant = "text",
  toggleLabels = { show: "Mostrar", hide: "Ocultar" },
  renderPasswordToggle,
  ...rest
}) => {
  const { width, height } = useWindowDimensions();
  const baseFrame = frame ?? { width, height };
  const minSide = Math.min(baseFrame.width, baseFrame.height);

  const [focused, setFocused] = useState(false);
  const [uncontrolled, setUncontrolled] = useState("");
  const [containerW, setContainerW] = useState(0);

  // === NUEVO ===
  const isPassword = variant === "password";
  const [visible, setVisible] = useState(false);
  const [pwdKey, setPwdKey] = useState(0); // fuerza remount en iOS al alternar

  const isFocused = focusedOverride ?? focused;
  const textValue = value ?? uncontrolled;

  // Dimensiones (puedes mantener tus clamps si quieres)
  const baseRem = clamp(minSide * 0.042, 14, 18);
  const radius = clamp(minSide * 0.018, 8, 12);
  const padH = clamp(minSide * 0.014, 12, 18);
  const padV = clamp(minSide * 0.01, 8, 14);
  const fontSize = clamp(baseRem * 1.05, 14, 20);
  const lineH = Math.round(fontSize * 1.25);
  const minH = Math.max(44, padV * 2 + lineH);
  const errorGap = clamp(minSide * 0.006, 4, 10);

  // deja espacio para el botón a la derecha si es password
  const rightPadForToggle = isPassword ? Math.max(44, padH * 2.5) : 0;

  const borderColor = !editable
    ? colors.neutral200
    : error
      ? colors.danger600
      : isFocused
        ? colors.primary600
        : colors.border;

  const commit = (raw: string) => {
    const stripped = raw.replace(/[\r\n]+$/, "");
    const normalized = stripped.trim().length ? stripped : null;
    if (value === undefined) setUncontrolled(normalized ?? "");
    onCommitValue?.(normalized);
  };

  const secure = isPassword ? !visible : rest.secureTextEntry;
  const effectiveMultiline = isPassword ? false : multiline;

  return (
    <View style={{ width: "100%" }}>
      <Label frame={frame} text={label} required={required} />

      <View
        onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
        style={{
          borderColor,
          borderWidth: 1,
          borderRadius: radius,
          backgroundColor: editable ? colors.neutral0 : "#F2F2F2",
          paddingHorizontal: padH,
          paddingVertical: padV,
          minHeight: minH,
          justifyContent: "center",
        }}
      >
        {/* Input */}
        <TextInput
          key={isPassword ? `pwd-${secure}-${pwdKey}` : undefined}
          allowFontScaling={false}
          {...rest}
          editable={editable}
          multiline={effectiveMultiline}
          scrollEnabled={false}
          textContentType="password" // activa gestor de contraseñas iOS
          autoComplete="password"
          value={textValue}
          onChangeText={(t) => {
            if (value === undefined) setUncontrolled(t);
            onChangeText?.(t);
          }}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            commit(textValue ?? "");
            onBlur?.(e);
          }}
          onKeyPress={(e) => {
            onKeyPress?.(e);
            // enter -> commit
            // @ts-ignore
            if (e?.nativeEvent?.key === "Enter" && Platform.OS === "web") e.preventDefault?.();
          }}
          onSubmitEditing={(ev) => {
            onSubmitEditing?.(ev as any);
            commit(textValue ?? "");
          }}
          blurOnSubmit={blurOnSubmit ?? true}
          returnKeyType={returnKeyType ?? "done"}
          secureTextEntry={secure}
          // textContentType={isPassword ? "password" : rest.textContentType}
          autoCapitalize={isPassword ? "none" : rest.autoCapitalize}
          autoCorrect={isPassword ? false : rest.autoCorrect}
          style={{
            fontSize,
            lineHeight: lineH,
            color: colors.textPrimary,
            padding: 0,
            // textAlignVertical: "top",
            // minHeight: lineH,
            width: containerW ? containerW - padH * 2 - rightPadForToggle : undefined,
          }}
          placeholder={variant === "password" ? (visible ? "Contraseña" : "••••••••") : placeholder}
          placeholderTextColor={colors.textSecondary}
        />

        {/* Botón Mostrar/Ocultar: SIEMPRE cuando variant=password */}
        {isPassword && (
          <Pressable
            onPress={() => {
              setVisible((v) => !v);
              setPwdKey((k) => k + 1); // fix iOS
            }}
            accessibilityRole="button"
            hitSlop={10}
            style={{
              position: "absolute",
              right: padH / 2,
              // top: "50%",
              // transform: [{ translateY: -lineH / 2 }],
              minWidth: 44,
              height: lineH + 8,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {renderPasswordToggle ? (
              renderPasswordToggle(visible)
            ) : (
              <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>
                {visible ? toggleLabels.hide || "Ocultar" : toggleLabels.show || "Mostrar"}
              </Text>
            )}
          </Pressable>
        )}
      </View>

      {error ? (
        <Caption
          frame={baseFrame}
          color="primary"
          style={{ color: colors.danger600, marginTop: errorGap }}
        >
          {error}
        </Caption>
      ) : null}
    </View>
  );
};

export default Input;
