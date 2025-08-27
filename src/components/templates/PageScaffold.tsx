// src/components/templates/PageScaffold.tsx
import ContainerSizer from "@/components/layout/ContainerSizer";
import FormHeader from "@/components/molecules/FormHeader";
import { useResponsive } from "@/hooks/useResponsive";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function PageScaffold({
  title,
  children,
  variant = "form",
  onBack,    
}: {
  title: string;
  children: React.ReactNode;
  variant: "categories" | "groups" | "form";
  onBack?: () => void;
}) {
  const { gutter } = useResponsive();
  const insets = useSafeAreaInsets();

  // 1) medimos la altura real del header para el offset del teclado
  const [headerH, setHeaderH] = useState(0);
  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    setHeaderH(e.nativeEvent.layout.height);
  }, []);

  // 2) offset total = insets.top + headerH
  const keyboardOffset = useMemo(() => insets.top + headerH, [insets.top, headerH]);


  const router = useRouter();
    // back por defecto (si no te pasan uno)
  const handleBack = useCallback(() => {
    if (onBack) return onBack();              // usa el que manden
    if (router.canGoBack()) router.back();    // pop normal
    else router.replace("/");                 // fallback (home)
  }, [onBack, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F6EE" }}>
      <View style={{ flex: 1 }}>
        {/* HEADER (estático, medido) */}
        <View onLayout={onHeaderLayout} style={{ paddingTop: gutter * 2 }}>
          <View style={{ paddingHorizontal: gutter * 2 }}>
            <FormHeader
              title={title}
              page={1}
              totalPages={3}
              connected
              onBack={handleBack}
              onRefresh={() => {}}
              variant={variant}
            />
          </View>
          {/* separador visual del header con el body */}
          <View style={{ height: gutter * 1 }} />
        </View>

        {/* BODY (scrollable) */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={keyboardOffset}
        >
          <ContainerSizer style={{ flex: 1 }}>
            <ScrollView
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              contentInsetAdjustmentBehavior={Platform.OS === "ios" ? "always" : "automatic"}
              contentContainerStyle={{
                // 3) padding dentro del Scroll para que también sea scrolleable
                paddingHorizontal: gutter * 2,
                paddingBottom: (insets.bottom || 0) + gutter * 2,
              }}
            >
              {/* 4) reemplazo de gap por separadores seguros */}
              <View style={{ marginBottom: gutter }}>{/* spacer bajo el header */}</View>
              {children}
              <View style={{ height: gutter * 2 }} />
            </ScrollView>
          </ContainerSizer>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
