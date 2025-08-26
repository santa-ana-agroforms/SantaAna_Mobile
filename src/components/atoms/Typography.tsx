import { Text, TextProps } from "react-native";
import { useResponsive } from "@/hooks/useResponsive";

type TProps = TextProps & { weight?: "regular" | "medium" | "semibold" | "bold"; color?: "primary" | "secondary" | "tertiary" | "inverse"; };

function font(weight: NonNullable<TProps["weight"]>) {
  switch (weight) {
    case "bold": return "Inter_700Bold";
    case "semibold": return "Inter_600SemiBold";
    case "medium": return "Inter_500Medium";
    default: return "Inter_400Regular";
  }
}

export function Title(props: TProps) {
  const { rem } = useResponsive();
  const { style, weight = "bold", color = "primary", ...rest } = props;
  const colorMap = { primary: "#1C1C1C", secondary: "#777777", tertiary: "#5A3E1B", inverse: "#FFFFFF" };
  return (
    <Text {...rest}
      style={[{ fontSize: rem * 2, color: colorMap[color], fontFamily: font(weight) }, style]}
    />
  );
}

export function Body(props: TProps) {
  const { rem } = useResponsive();
  const { style, weight = "regular", color = "primary", ...rest } = props;
  const colorMap = { primary: "#1C1C1C", secondary: "#777777", tertiary: "#5A3E1B", inverse: "#FFFFFF" };
  return (
    <Text {...rest}
      style={[{ fontSize: rem * 1.2, color: colorMap[color], fontFamily: font(weight) }, style]}
    />
  );
}

export function Caption(props: TProps) {
  const { rem } = useResponsive();
  const { style, weight = "medium", color = "secondary", ...rest } = props;
  const colorMap = { primary: "#1C1C1C", secondary: "#777777", tertiary: "#5A3E1B", inverse: "#FFFFFF" };
  return (
    <Text {...rest}
      style={[{ fontSize: rem * 1.5, color: colorMap[color], fontFamily: font(weight) }, style]}
    />
  );
}
