import FormHeader from "@/components/molecules/FormHeader";
import { colors } from "@/theme/tokens";
import { getLastUpdatedDate, setLastUpdatedNow } from "@/utils/lastUpdated";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 👇 NetInfo para estado de conexión en tiempo real
import NetInfo from "@react-native-community/netinfo";

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
  // 👇 NUEVA PROP: Permite que el padre actualice la fecha externamente
  lastSyncProp?: Date | null;
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
  lastSyncProp, // ⬅️ Recibimos la prop
}) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [connected, setConnected] = useState<boolean>(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [headerH, setHeaderH] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);

  // 1. Al enfocar, leer fecha guardada (comportamiento original)
  useFocusEffect(
    useCallback(() => {
      const d = getLastUpdatedDate();
      if (d) setLastUpdatedAt(d);
      return () => {};
    }, [])
  );

  // 2. NUEVO: Si el padre manda una nueva fecha (porque terminó de sync), actualizar estado
  useEffect(() => {
    if (lastSyncProp) {
      setLastUpdatedAt(lastSyncProp);
    }
  }, [lastSyncProp]);

  // 3. Listener de Conexión en Tiempo Real
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // Lógica optimista: si internetReachable es null, asumimos true si hay conexión física
      const isOnline = !!state.isConnected && (state.isInternetReachable ?? true);
      setConnected(isOnline);
    });

    NetInfo.fetch().then((state) => {
      const isOnline = !!state.isConnected && (state.isInternetReachable ?? true);
      setConnected(isOnline);
    });

    return () => unsubscribe();
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
    setLastUpdatedAt(new Date()); // Actualización visual inmediata
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
              lastUpdatedAt={lastUpdatedAt ?? undefined}
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
