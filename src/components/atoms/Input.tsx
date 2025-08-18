import { useState } from "react";
import { View, TextInput, TextInputProps } from "react-native";
import { Caption } from "./Typography";
import { colors } from "@/theme/tokens";
import { useResponsive } from "@/hooks/useResponsive";

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export default function Input({ label, error, editable = true, style, ...rest }: Props) {
  const { rem } = useResponsive();
  const [focused, setFocused] = useState(false);

  const borderColor = !editable ? colors.neutral200 : error ? colors.danger600 : focused ? colors.primary600 : colors.border;
  const bg = editable ? colors.neutral0 : "#F2F2F2";

  return (
    <View style={{ width: "100%" }}>
      {label ? <Caption weight="semibold" color="tertiary" style={{ marginBottom: rem * 0.35 }}>{label}</Caption> : null}

      <View style={{ borderColor, borderWidth: 1, borderRadius: 8, backgroundColor: bg, paddingHorizontal: 12, paddingVertical: 10 }}>
        <TextInput
          {...rest}
          editable={editable}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          style={[{ fontSize: rem * 1.5, fontFamily: "Inter_400Regular", color: colors.textPrimary, padding: 0 }, style]}
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      {error ? <Caption color="primary" style={{ color: colors.danger600, marginTop: rem * 0.25 }}>{error}</Caption> : null}
    </View>
  );
}
