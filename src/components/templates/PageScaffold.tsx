// src/components/templates/PageScaffold.tsx
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text } from "react-native";
import { useResponsive } from "@/hooks/useResponsive";
import ContainerSizer from "@/components/layout/ContainerSizer";

export default function PageScaffold({
  title, right, children,
}: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  const { gutter, rem } = useResponsive();

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header con padding */}
      <View className="flex-row items-center justify-between"
            style={{ paddingHorizontal: gutter, paddingVertical: gutter/1.2 }}>
        <Text className="text-text-primary" style={{ fontSize: rem*1.25, fontFamily: "Inter_700Bold" }}>
          {title}
        </Text>
        {right ?? null}
      </View>

      {/* Body: wrapper con padding → ContainerSizer sin padding */}
      <View style={{ flex: 1, paddingHorizontal: gutter }}>
        <ContainerSizer style={{ flex: 1 }}>
          {children}
        </ContainerSizer>
      </View>
    </SafeAreaView>
  );
}
