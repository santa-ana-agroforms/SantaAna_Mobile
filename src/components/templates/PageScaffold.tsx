import FormHeader from "@/components/molecules/FormHeader";
import { colors } from "@/theme/tokens";
import { isOnline } from "@/utils/network";
import NetInfo from "@react-native-community/netinfo";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  // refs para detectar reconexión y evitar múltiples refresh seguidos
  const prevConnectedRef = useRef<boolean | null>(null);
  const lastAutoRefreshRef = useRef<number>(0);
  const AUTORELOAD_COOLDOWN_MS = 5000;

  // Chequeo inicial de conectividad
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ok = await isOnline();
        if (mounted) {
          setConnected(!!ok);
          prevConnectedRef.current = !!ok;
        }
      } catch {
        if (mounted) {
          setConnected(false);
          prevConnectedRef.current = false;
        }
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

  // Refresco manual o automático (marca el timestamp exacto)
  const handleRefreshPress = useCallback(async () => {
    // 1️⃣ Registrar la hora de actualización
    setLastUpdatedAt(new Date());

    // 2️⃣ Revisar conectividad actual
    try {
      const ok = await isOnline();
      setConnected(!!ok);
    } catch {
      setConnected(false);
    }

    // 3️⃣ Notificar al padre y actualizar el nonce
    onRefresh?.();
    setRefreshNonce((n) => n + 1);
  }, [onRefresh]);

  // 🔄 Disparar refresh automáticamente al reconectar (offline → online)
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const nowOnline = !!state.isConnected && (state.isInternetReachable ?? true);
      setConnected(nowOnline);

      const prev = prevConnectedRef.current;
      prevConnectedRef.current = nowOnline;

      // Detectar transición de offline → online
      if (prev === false && nowOnline) {
        const now = Date.now();
        if (now - lastAutoRefreshRef.current > AUTORELOAD_COOLDOWN_MS) {
          lastAutoRefreshRef.current = now;
          handleRefreshPress(); // ← ejecuta refresh + actualiza timestamp
        }
      }
    });
    return () => unsub();
  }, [handleRefreshPress]);

  const scaffoldDimensions: ScaffoldDimensions = {
    layoutFrame,
    contentFrame,
    referenceFrame,
    refreshNonce,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingBottom: insets.bottom }}>
      <View style={{ flex: 1 }}>
        {/* HEADER */}
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

        {/* BODY */}
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
