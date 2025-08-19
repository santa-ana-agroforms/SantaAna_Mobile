import { Pressable, ViewStyle, TextStyle, GestureResponderEvent } from "react-native";
import { Body } from "./Typography";
import { colors, ButtonSize, ButtonVariant } from "@/theme/tokens";
import { useResponsive } from "@/hooks/useResponsive";

type Props = {
  title: string;
  onPress?: (e: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export default function Button({
  title, onPress, variant = "primary", size = "md", disabled, style, textStyle,
}: Props) {
  const { scale, rem } = useResponsive();

  const height = size === "sm" ? scale(36) : size === "lg" ? scale(52) : scale(44);
  const radius = 8;

  let bg = colors.primary600, fg = "#FFFFFF", borderColor = "transparent", borderWidth = 0, opacity = disabled ? 0.6 : 1;

  if (variant === "ghost") { bg = "transparent"; fg = colors.textPrimary; borderColor = colors.border; borderWidth = 1; }
  if (variant === "danger") { bg = colors.danger600; fg = "#FFFFFF"; }

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: "rgba(0,0,0,0.08)" }}
      style={[{ height, borderRadius: radius, backgroundColor: bg, alignItems: "center", justifyContent: "center", opacity, borderColor, borderWidth, paddingHorizontal: 16 }, style]}
    >
      <Body weight="bold" color={variant === "ghost" ? "primary" : "inverse"}
            style={[{ fontSize: rem * 1.5 }, textStyle]}>
        {title}
      </Body>
    </Pressable>
  );
}
