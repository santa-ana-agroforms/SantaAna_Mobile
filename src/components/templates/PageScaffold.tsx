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

type Variant = "categories" | "groups" | "form";

type PageScaffoldProps = {
  title: string;
  children: React.ReactNode;
  variant?: Variant;
  onBack?: () => void;
  // sólo para variant="form"
  page?: number;
  totalPages?: number;
  onPrevPage?: () => void;
  onNextPage?: () => void;
};

export default function PageScaffold({
  title,
  children,
  variant = "form",
  onBack,
  page = 1,
  totalPages = 1,
  onPrevPage,
  onNextPage,
}: PageScaffoldProps) {
  const { gutter } = useResponsive();
  const insets = useSafeAreaInsets();

  const [headerH, setHeaderH] = useState(0);
  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    // evita loops de layout: solo set si cambió de verdad
    setHeaderH((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
  }, []);

  const keyboardOffset = useMemo(() => insets.top + headerH, [insets.top, headerH]);

  const router = useRouter();
  const handleBack = useCallback(() => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [onBack, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F6EE" }}>
      <View style={{ flex: 1 }}>
        {/* HEADER (estático, medido) */}
        <View onLayout={onHeaderLayout} style={{ paddingTop: gutter * 2 }}>
          <View style={{ paddingHorizontal: gutter * 2 }}>
            <FormHeader
              title={title}
              page={page}
              totalPages={totalPages}
              connected
              onBack={handleBack}
              onRefresh={() => {}}
              variant={variant}
              onPrevPage={variant === "form" ? onPrevPage : undefined}
              onNextPage={variant === "form" ? onNextPage : undefined}
            />
          </View>
          <View style={{ height: gutter * 1 }} />
        </View>

        {/* BODY */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={keyboardOffset}
        >
          {variant === "form" ? (
            // 👇 SIN ScrollView padre: deja que cada página maneje su propio scroll vertical
            <ContainerSizer style={{ flex: 1 }}>
              <View style={{ flex: 1 }}>{children}</View>
            </ContainerSizer>
          ) : (
            // variantes categories/groups: un único ScrollView
            <ContainerSizer style={{ flex: 1 }}>
              <ScrollView
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                contentInsetAdjustmentBehavior={Platform.OS === "ios" ? "always" : "automatic"}
                contentContainerStyle={{
                  paddingHorizontal: gutter * 2,
                  paddingBottom: (insets.bottom || 0) + gutter * 2,
                }}
              >
                <View style={{ marginBottom: gutter }} />
                {children}
                <View style={{ height: gutter * 2 }} />
              </ScrollView>
            </ContainerSizer>
          )}
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
