// components/templates/PageScaffold.tsx
import FormHeader from "@/components/molecules/FormHeader";
import { colors } from "@/theme/tokens";
import { getLastUpdatedDate, setLastUpdatedNow } from "@/utils/lastUpdated"; // ⬅️ nuevo
import { isOnline } from "@/utils/network";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Variant = "categories" | "groups" | "form";

export interface ScaffoldDimensions {
  layoutFrame: { width: number; height: number };
  contentFrame: { width: number; height: number };
  referenceFrame: { width: number; height: number };
  refreshNonce: number;
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
  onRefresh?: () => void;
  refreshing?: boolean;
};

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
  onRefresh,
}) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [connected, setConnected] = useState<boolean>(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [headerH, setHeaderH] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);

  // 💡 Al enfocar la pantalla, toma la fecha global (si existe) y muéstrala.
  useFocusEffect(
    useCallback(() => {
      const d = getLastUpdatedDate();
      if (d) setLastUpdatedAt(d);
      return () => {};
    }, [])
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ok = await isOnline();
        if (mounted) setConnected(!!ok);
      } catch {
        if (mounted) setConnected(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const padX = useMemo(() => clamp(width * 0.04, 12, 24), [width]);
  const padTopHeader = useMemo(() => height * 0, [height]);
  const gapBelowHeader = useMemo(() => clamp(height * 0.012, 8, 16), [height]);

  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setHeaderH((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
  }, []);

  const handleBack = useCallback(() => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [onBack, router]);

  const layoutHeight = Math.max(0, height - insets.top - insets.bottom - headerH);
  const layoutFrame = { width, height: layoutHeight };
  const contentFrame = { width: layoutFrame.width - 2 * padX, height: layoutFrame.height };
  const referenceFrame = { ...layoutFrame };

  const handleRefreshPress = useCallback(async () => {
    setLastUpdatedNow();
    // Si quieres, puedes seguir actualizando la fecha al refrescar manualmente:
    setLastUpdatedAt(new Date());
    onRefresh?.();
    setRefreshNonce((n) => n + 1);
  }, [onRefresh]);

  const scaffoldDimensions: ScaffoldDimensions = {
    layoutFrame,
    contentFrame,
    referenceFrame,
    refreshNonce,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingBottom: insets.bottom }}>
      <View style={{ flex: 1 }}>
        <View onLayout={onHeaderLayout}>
          <View style={{ paddingTop: padTopHeader, paddingBottom: gapBelowHeader }}>
            <FormHeader
              title={title}
              page={page}
              totalPages={totalPages}
              frame={referenceFrame}
              connected={connected}
              lastUpdatedAt={lastUpdatedAt ?? undefined} // ⬅️ se refleja en el header
              onBack={handleBack}
              onRefresh={handleRefreshPress}
              variant={variant}
              onPrevPage={variant === "form" ? onPrevPage : undefined}
              onNextPage={variant === "form" && canNext !== false ? onNextPage : undefined}
            />
          </View>
        </View>

        {variant === "form" ? (
          <View
            key={`body-${refreshNonce}`}
            style={{ height: layoutFrame.height, backgroundColor: colors.surface }}
          >
            {typeof children === "function" ? children(scaffoldDimensions) : children}
          </View>
        ) : (
          <ScrollView
            key={`scroll-${refreshNonce}`}
            contentContainerStyle={{ paddingHorizontal: padX }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ marginBottom: gapBelowHeader }} />
            {typeof children === "function" ? children(scaffoldDimensions) : children}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

export default PageScaffold;
