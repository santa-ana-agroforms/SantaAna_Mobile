// src/components/atoms/QrScannerButton.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";

type Props = {
  onPress: () => void;
  size?: number; // lado del recuadro central (px)
  disabled?: boolean;
  testID?: string;
  offset?: number; // separación de las esquinas (px)
};

export default function QrScannerButton({
  onPress,
  size = 220,
  disabled = false,
  testID,
  offset = 12,
}: Props) {
  const bw = Math.max(4, Math.round(size * 0.035));
  const corner = Math.round(size * 0.18);
  const radius = Math.round(size * 0.15);
  const icon = Math.round(size * 0.6);

  // --- Animated values
  const sweep = useRef(new Animated.Value(0)).current; // 0..1 para mover la línea
  const breath = useRef(new Animated.Value(0)).current; // 0..1 para scale
  const cornersPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Línea que sube y baja
    Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Breathing muy sutil
    Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Pulso de esquinas
    Animated.loop(
      Animated.sequence([
        Animated.timing(cornersPulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(cornersPulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [sweep, breath, cornersPulse]);

  // Derivados
  const scanTranslateY = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-(size / 2) + 10, size / 2 - 10], // recorre casi todo el alto
  });

  const plateScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.995, 1],
  });

  const cornerOpacity = cornersPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Escanear código QR"
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: "#00000022", borderless: false }}
      style={({ pressed }) => [
        { alignSelf: "center" },
        pressed && { transform: [{ scale: 0.985 }] },
        disabled && { opacity: 0.5 },
      ]}
    >
      {/* Contenedor relativo con tamaño fijo */}
      <View style={{ position: "relative", width: size, height: size }}>
        {/* Corners con pulso */}
        <Animated.View
          style={[
            styles.corner,
            {
              opacity: cornerOpacity,
              top: -bw / 2 - offset,
              left: -bw / 2 - offset,
              width: corner,
              height: corner,
              borderTopLeftRadius: radius,
              borderRightWidth: 0,
              borderBottomWidth: 0,
              borderWidth: bw,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.corner,
            {
              opacity: cornerOpacity,
              top: -bw / 2 - offset,
              right: -bw / 2 - offset,
              width: corner,
              height: corner,
              borderTopRightRadius: radius,
              borderLeftWidth: 0,
              borderBottomWidth: 0,
              borderWidth: bw,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.corner,
            {
              opacity: cornerOpacity,
              bottom: -bw / 2 - offset,
              left: -bw / 2 - offset,
              width: corner,
              height: corner,
              borderBottomLeftRadius: radius,
              borderRightWidth: 0,
              borderTopWidth: 0,
              borderWidth: bw,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.corner,
            {
              opacity: cornerOpacity,
              bottom: -bw / 2 - offset,
              right: -bw / 2 - offset,
              width: corner,
              height: corner,
              borderBottomRightRadius: radius,
              borderLeftWidth: 0,
              borderTopWidth: 0,
              borderWidth: bw,
            },
          ]}
        />

        {/* Placa con “breathing” */}
        <Animated.View
          style={[
            styles.plate,
            { width: size, height: size, borderRadius: radius, transform: [{ scale: plateScale }] },
          ]}
        >
          {/* Scan line animada */}
          <Animated.View
            style={[
              styles.scanLine,
              {
                width: size - 8,
                height: size * 0.03,
                transform: [{ translateY: scanTranslateY }],
              },
            ]}
          />
          <Ionicons name="qr-code" size={icon} color="#111" />
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  corner: {
    position: "absolute",
    borderColor: "#111",
  },
  plate: {
    backgroundColor: "#D9D9D9",
    borderWidth: 2,
    borderColor: "#E6E6E6",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden", // para que la línea no se salga
  },
  scanLine: {
    position: "absolute",
    height: 2,
    backgroundColor: "#111",
    opacity: 0.65,
  },
});
