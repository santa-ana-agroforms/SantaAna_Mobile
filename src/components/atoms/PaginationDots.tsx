// src/components/atoms/PaginationDots.tsx
import { View } from "react-native";
import { colors } from "@/theme/tokens";
import { useResponsive } from "@/hooks/useResponsive";

export default function PaginationDots({
  total,
  activeIndex,
}: {
  total: number;
  activeIndex: number; // 0-based
}) {
  const { rem } = useResponsive();
  const size = rem * 1;
  const gap = rem * 1;

  return (
    <View style={{ flexDirection: "row", gap }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: i === activeIndex ? colors.textPrimary : colors.neutral200,
          }}
        />
      ))}
    </View>
  );
}
