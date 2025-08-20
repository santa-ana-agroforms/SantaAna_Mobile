import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text } from "react-native";
import { useResponsive } from "@/hooks/useResponsive";
import ContainerSizer from "@/components/layout/ContainerSizer";

export default function PageScaffold({
  title, right, children,
}: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  const { gutter, rem } = useResponsive();

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: "#F9F6EE" }}>
      {/* Header */}
      <View className="flex-row items-center justify-between"
            style={{ paddingHorizontal: gutter * 2, paddingVertical: gutter / 1 }}>
        <Text
          className="text-text-primary"
          style={{ fontSize: rem * 2.25, fontFamily: "Inter_700Bold" }}
        >
          {title}
        </Text>
        {right ?? null}
      </View>

      {/* Body: padding en wrapper, ContainerSizer sin padding (para medir área útil) */}
      <View style={{ flex: 1, paddingHorizontal: gutter * 2 }}>
        <ContainerSizer style={{ flex: 1 }}>
          {children}
        </ContainerSizer>
      </View>
    </SafeAreaView>
  );
}
