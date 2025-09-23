import { useResponsive } from "@/hooks/useResponsive";
import { colors } from "@/theme/tokens";
import { View } from "react-native";
import { Caption } from "./Typography";

export default function Badge({ text }: { text: string }) {
  const { rem } = useResponsive();
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: colors.warningBg,
        borderRadius: 999,
        paddingHorizontal: rem * 0.6,
        paddingVertical: rem * 0.35,
      }}
    >
      <Caption weight="semibold" color="primary">
        {text}
      </Caption>
    </View>
  );
}
