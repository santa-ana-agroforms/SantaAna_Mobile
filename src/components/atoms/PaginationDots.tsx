// src/components/atoms/PaginationDots.tsx
import { useResponsive } from "@/hooks/useResponsive";
import { colors } from "@/theme/tokens";
import { View } from "react-native";

const PaginationDots = ({
  total,
  activeIndex,
}: {
  total: number;
  activeIndex: number; // 0-based
}) => {
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
};

export default PaginationDots;
