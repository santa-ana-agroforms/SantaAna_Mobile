// app/_layout.tsx
/* eslint-disable react-hooks/rules-of-hooks */
import { getAccessToken, setApiBase } from "@/api/client";
import { registerFormSessionListeners } from "@/forms/state/registerFormSessionListeners";
import { persistor, startAppListening, store } from "@/store";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { Stack, usePathname, useRootNavigationState, useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";
import { useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager, Platform, StatusBar } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { enableFreeze, enableScreens } from "react-native-screens";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

enableScreens(true);
enableFreeze(true);

const DrizzleStudioBinder: React.FC = () => {
  if (!__DEV__) return null;
  const db = useMemo(() => SQLite.openDatabaseSync("forms.db"), []);
  useDrizzleStudio(db);
  return null;
};

registerFormSessionListeners(startAppListening);

const RootLayout = () => {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [checking, setChecking] = useState(true);
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  const bootRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const rootNavState = useRootNavigationState();
  const redirectedRef = useRef(false);

  const [showDevTools, setShowDevTools] = useState(false);
  useEffect(() => {
    const t = InteractionManager.runAfterInteractions(() => setShowDevTools(true));
    return () => t.cancel();
  }, []);

  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;

    (async () => {
      try {
        console.log("[BOOT] setting API base URL...", process.env.EXPO_PUBLIC_BASE_URL);
        await setApiBase(process.env.EXPO_PUBLIC_BASE_URL?.trim() || "");
        const token = await getAccessToken();
        setHasToken(!!token);
      } catch (e) {
        console.log("[BOOT] error:", e);
        setHasToken(false);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded || checking || hasToken === null) return;
    if (!rootNavState?.key) return;
    if (redirectedRef.current) return;

    const isTest = process.env.EXPO_PUBLIC_TEST === "true";

    const target = isTest ? "/test" : hasToken ? "/" : "/qr";

    // ✅ Marca como ya redirigido aunque estés en target,
    // para que al navegar luego NO te empuje de regreso.
    redirectedRef.current = true;

    if (pathname !== target) {
      InteractionManager.runAfterInteractions(() => router.replace(target));
    }
  }, [loaded, checking, hasToken, rootNavState?.key, pathname, router]);

  if (!loaded || checking || hasToken === null || !rootNavState?.key) {
    return null;
  }

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <KeyboardProvider>
          <SafeAreaProvider>
            <StatusBar translucent={false} hidden={false} />
            <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
              {__DEV__ && showDevTools ? <DrizzleStudioBinder /> : null}
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: Platform.OS === "ios" ? "default" : "slide_from_right",
                  gestureEnabled: true,
                  fullScreenGestureEnabled: true,
                  freezeOnBlur: false,
                  statusBarAnimation: Platform.OS === "ios" ? "fade" : undefined,
                  contentStyle: { backgroundColor: "#F9F6EE" },
                  animationTypeForReplace: "push",
                }}
              >
                <Stack.Screen
                  name="qr"
                  options={{
                    presentation: "card",
                    animation: Platform.OS === "ios" ? "default" : "slide_from_right",
                  }}
                />
              </Stack>
            </SafeAreaView>
          </SafeAreaProvider>
        </KeyboardProvider>
      </PersistGate>
    </Provider>
  );
};

export default RootLayout;
