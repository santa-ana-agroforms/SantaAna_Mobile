// app/_layout.tsx
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { getAccessToken, setApiBase } from "@/api/client";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack, Redirect } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableScreens, enableFreeze } from "react-native-screens";

// 👉 activa optimizaciones nativas (hacerlo fuera del componente)
enableScreens(true);
enableFreeze(true);

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [checking, setChecking] = useState(true);
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await setApiBase("http://192.168.129.165:3000/");
        const token = await getAccessToken();
        if (mounted) setHasToken(!!token);
      } catch (e) {
        console.log("[BOOT] error:", e);
        if (mounted) setHasToken(false);
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (!loaded || checking) return null;

  return (
    <SafeAreaProvider>
      {/* Redirección declarativa */}
      {hasToken === true && <Redirect href="/" />}
      {hasToken === false && <Redirect href="/qr" />}

      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade", // 👈 la más fluida en general
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          statusBarAnimation: Platform.OS === "ios" ? "fade" : undefined,
          contentStyle: { backgroundColor: "#F9F6EE" }, // evita flashes
        }}
      >
        {/* Modal QR con animación suave vertical */}
        <Stack.Screen
          name="qr"
          options={{
            presentation: "modal",
            animation: "fade_from_bottom",
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
