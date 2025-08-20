import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text } from "react-native";
import "../global.css"

export default function Index() {
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-1 items-center justify-center">
        <Text
          className="text-text-primary"
          style={{ fontFamily: "Inter_700Bold", fontSize: 22 }}
        >
          NativeWind OK ✅
        </Text>

        <View className="bg-primary-600 px-5 py-2 rounded-2xl mt-4">
          <Text
            className="text-white"
            style={{ fontFamily: "Inter_600SemiBold", fontSize: 16 }}
          >
            Botón
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
