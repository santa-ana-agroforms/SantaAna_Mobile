import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text } from "react-native";
import { useResponsive } from "@/hooks/useResponsive";
import ContainerSizer from "@/components/layout/ContainerSizer";
import FormHeader from "../molecules/FormHeader";

export default function PageScaffold({
  title, right, children,
}: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  const { gutter, rem } = useResponsive();

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: "#F9F6EE" }}>
      <View style={{ flex: 1, paddingHorizontal: gutter * 2, paddingTop: gutter * 2 }}>
        {/* Header */}
        <FormHeader
          title="Calidad de corte manual"
          page={1}
          totalPages={3}
          connected
          onBack={() => {}}
          onRefresh={() => {}}
        />

        {/* Body: padding en wrapper, ContainerSizer sin padding (para medir área útil) */}
        <ContainerSizer style={{ flex: 1 }}>
          {children}
        </ContainerSizer>
      </View>
    </SafeAreaView>
  );
}
