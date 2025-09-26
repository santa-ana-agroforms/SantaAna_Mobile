import { fetchAndSaveForms } from "@/api/forms";
import { pullAndCacheGroups } from "@/api/groups";
import FormHeader from "@/components/molecules/FormHeader";
import { colors } from "@/theme/tokens";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { LayoutChangeEvent, ScrollView, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type Variant = "categories" | "groups" | "form";

export interface ScaffoldDimensions {
  layoutFrame: { width: number; height: number };
  contentFrame: { width: number; height: number };
  referenceFrame: { width: number; height: number };
}

type PageScaffoldProps = {
  title: string;
  children: React.ReactNode | ((dims: ScaffoldDimensions) => React.ReactNode);
  variant?: Variant;
  onBack?: () => void;
  page?: number;
  totalPages?: number;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  canNext?: boolean;
};
/** ⬆️ Mantener estos exports tal cual */

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const PageScaffold: React.FC<PageScaffoldProps> = ({
  title,
  children,
  variant = "form",
  onBack,
  page = 1,
  totalPages = 1,
  onPrevPage,
  onNextPage,
  canNext,
}) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Espaciados proporcionales
  const padX = useMemo(() => clamp(width * 0.04, 12, 24), [width]);
  const padTopHeader = useMemo(() => clamp(height * 0.01, 8, 24), [height]);
  const gapBelowHeader = useMemo(() => clamp(height * 0.012, 8, 16), [height]);

  const [headerH, setHeaderH] = useState(0);
  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setHeaderH((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
  }, []);

  const router = useRouter();
  const handleBack = useCallback(() => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [onBack, router]);

  // Frames escalables
  const layoutHeight = Math.max(0, height - insets.top - insets.bottom - headerH);
  const layoutFrame = { width, height: layoutHeight };

  const innerWidth = layoutFrame.width - 2 * padX;

  const contentFrame = {
    width: innerWidth,
    height: layoutFrame.height,
  };

  // Referencia general (área útil debajo del header)
  const referenceFrame = { ...layoutFrame };

  const scaffoldDimensions: ScaffoldDimensions = {
    layoutFrame,
    contentFrame,
    referenceFrame,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ flex: 1 }}>
        {/* HEADER (estático, medido) */}
        <View onLayout={onHeaderLayout}>
          <View style={{ paddingTop: padTopHeader, paddingBottom: gapBelowHeader }}>
            <FormHeader
              title={title}
              page={page}
              frame={referenceFrame}
              totalPages={totalPages}
              connected
              onBack={handleBack}
              onRefresh={async () => {
                await fetchAndSaveForms();
                await pullAndCacheGroups();
              }}
              variant={variant}
              onPrevPage={variant === "form" ? onPrevPage : undefined}
              onNextPage={variant === "form" && canNext !== false ? onNextPage : undefined}
            />
          </View>
        </View>

        {/* BODY */}
        {variant === "form" ? (
          // 👉 Contenedor con altura fija para que PagerView/children tengan espacio
          <View
            style={{
              height: layoutFrame.height,
              // paddingHorizontal: padX,
              backgroundColor: colors.surface,
            }}
          >
            <View style={{ marginBottom: gapBelowHeader }} />
            {typeof children === "function" ? children(scaffoldDimensions) : children}
          </View>
        ) : (
          // Otras variantes sí usan ScrollView
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: padX }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ marginBottom: gapBelowHeader }} />
            {typeof children === "function" ? children(scaffoldDimensions) : children}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

export default PageScaffold;
