// app/_layout.tsx
import { setApiBase } from "@/api/client";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  if (!loaded) return null;
  (async () => {
    await setApiBase("http://192.168.168.236:3000/");
  })();

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {/* 👉 esta línea habilita la presentación tipo modal */}
        <Stack.Screen name="qr" options={{ presentation: "modal" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
