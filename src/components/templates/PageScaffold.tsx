import ContainerSizer from "@/components/layout/ContainerSizer";
import FormHeader from "@/components/molecules/FormHeader";
import { colors } from "@/theme/tokens";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

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
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const PageScaffold: React.FC<PageScaffoldProps> = ({
  title,
  children,
  variant = "form",
  onBack,
  page = 1,
  totalPages = 1,
  onPrevPage,
  onNextPage,
}) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Espaciados proporcionales (reemplazan 16, 12, 32)
  // - padX: padding horizontal en header/scroll
  // - padTopHeader: separación superior del header
  // - gapBelowHeader: “respiro” bajo el header
  // - padBottomScroll: padding inferior del scroll (insets + padX)
  const padX = useMemo(() => clamp(width * 0.04, 12, 24), [width]); // ≈4% del ancho
  const padTopHeader = useMemo(() => clamp(height * 0.01, 8, 24), [height]); // ≈2% del alto
  const gapBelowHeader = useMemo(() => clamp(height * 0.012, 8, 16), [height]);
  const padBottomScroll = useMemo(
    () => (insets.bottom || 0) + padX,
    [insets.bottom, padX],
  );

  const [headerH, setHeaderH] = useState(0);
  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setHeaderH((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
  }, []);

  const keyboardOffset = useMemo(
    () => insets.top + headerH,
    [insets.top, headerH],
  );

  const router = useRouter();
  const handleBack = useCallback(() => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [onBack, router]);

  // 🔹 Frames escalables
  const layoutHeight = height - insets.top - insets.bottom - headerH;
  const layoutFrame = { width, height: layoutHeight };

  const innerWidth = layoutFrame.width - 2 * padX;

  const contentFrame = {
    width: innerWidth,
    height: layoutFrame.height /* - opcional gapBelowHeader */,
  };

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
          <View
            style={{ paddingTop: padTopHeader, paddingBottom: gapBelowHeader }}
          >
            <FormHeader
              title={title}
              page={page}
              frame={referenceFrame}
              totalPages={totalPages}
              connected
              onBack={handleBack}
              onRefresh={() => {}}
              variant={variant}
              onPrevPage={variant === "form" ? onPrevPage : undefined}
              onNextPage={variant === "form" ? onNextPage : undefined}
            />
          </View>
        </View>

        {/* BODY */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={keyboardOffset}
        >
          {variant === "form" ? (
            <ContainerSizer style={{ flex: 1 }}>
              <View style={{ flex: 1 }}>
                {typeof children === "function"
                  ? children(scaffoldDimensions)
                  : children}
              </View>
            </ContainerSizer>
          ) : (
            <ContainerSizer style={{ flex: 1 }}>
              <ScrollView
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={
                  Platform.OS === "ios" ? "interactive" : "on-drag"
                }
                contentInsetAdjustmentBehavior={
                  Platform.OS === "ios" ? "always" : "automatic"
                }
                contentContainerStyle={{
                  paddingHorizontal: padX,
                  paddingBottom: padBottomScroll,
                }}
              >
                <View style={{ marginBottom: gapBelowHeader }} />
                {typeof children === "function"
                  ? children(scaffoldDimensions)
                  : children}
                <View style={{ height: padX * 2 }} />
              </ScrollView>
            </ContainerSizer>
          )}
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
};

export default PageScaffold;
