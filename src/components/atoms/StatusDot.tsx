// src/components/atoms/StatusDot.tsx
import { useResponsive } from "@/hooks/useResponsive";
import { colors } from "@/theme/tokens";
import { View } from "react-native";

type Status = "online" | "offline" | "syncing";

export default function StatusDot({ status = "online", size }: { status?: Status; size?: number }) {
  const { rem } = useResponsive();
  const S = size ?? rem * 0.6;
  const color =
    status === "online"
      ? colors.primary600
      : status === "syncing"
        ? colors.warningBg
        : colors.danger600;

  return (
    <View
      style={{
        width: S,
        height: S,
        borderRadius: S / 2,
        backgroundColor: color,
      }}
    />
  );
}
