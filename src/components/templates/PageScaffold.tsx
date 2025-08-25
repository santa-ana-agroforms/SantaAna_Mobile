// src/components/templates/PageScaffold.tsx
import ContainerSizer from "@/components/layout/ContainerSizer";
import FormHeader from "@/components/molecules/FormHeader";
import { useResponsive } from "@/hooks/useResponsive";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function PageScaffold({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { gutter } = useResponsive();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: "#F9F6EE" }}>
      {/* Layout vertical: header fijo + body scrollable */}
      <View style={{ flex: 1, paddingHorizontal: gutter * 2, paddingTop: gutter * 2 }}>
        {/* HEADER (estático) */}
        <FormHeader
          title={title}
          page={1}
          totalPages={3}
          connected
          onBack={() => {}}
          onRefresh={() => {}}
        />

        {/* BODY (scrollable) */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={insets.top} // evita que el teclado tape inputs bajo el header
        >
          <ContainerSizer style={{ flex: 1 }}>
            <ScrollView
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingTop: gutter,         // respiro bajo el header
                paddingBottom: insets.bottom + gutter * 2, // espacio para último control
                rowGap: gutter,             // si usas Views apiladas
              }}
            >
              {children}
            </ScrollView>
          </ContainerSizer>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
