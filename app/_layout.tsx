import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
} from "@expo-google-fonts/inter";

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });
  if (!loaded) return null;               // ⚠️ si no carga la fuente, no renderices el header

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />  {/* sin “index” arriba */}
    </SafeAreaProvider>
  );
}
