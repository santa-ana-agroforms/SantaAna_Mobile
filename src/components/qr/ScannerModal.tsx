// components/qr/ScannerModal.tsx
import { setApiBase } from "@/api/client";
import Button from "@/components/atoms/Button";
import { Body } from "@/components/atoms/Typography";
import { useResponsive } from "@/hooks/useResponsive";
import { colors } from "@/theme/tokens";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, Easing, Modal, StyleSheet, View } from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  onQr: (data: string) => void;
  statusText?: string | null;
};

export default function ScannerModal({ visible, onClose, onQr, statusText }: Props) {
  const { rem } = useResponsive();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [armed, setArmed] = useState(true);
  const lastScanAtRef = useRef<number>(0);
  (async () => { if (!permission?.granted) await setApiBase("http://192.168.46.17:3000/"); })();

  const win = Dimensions.get("window");
  const BOX = Math.min(300, Math.round(win.width * 0.75));

  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, [sweep]);
  const scanY = sweep.interpolate({ inputRange: [0, 1], outputRange: [-(BOX / 2) + 8, (BOX / 2) - 8] });

  useEffect(() => {
    if (!visible) return;
    (async () => { if (!permission?.granted) await requestPermission(); })();
  }, [visible, permission?.granted, requestPermission]);

  const handleScan = useCallback((ev: BarcodeScanningResult) => {
    if (!armed) return;
    const now = Date.now();
    if (now - lastScanAtRef.current < 1200) return;
    lastScanAtRef.current = now;
    setArmed(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).finally(() => onQr(ev.data ?? ""));
    setTimeout(() => setArmed(true), 2000);
  }, [armed, onQr]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={styles.wrap}>
        {permission?.granted ? (
          <>
            <CameraView
              style={styles.camera}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={handleScan}
            />

            {/* Overlay absoluto */}
            <View style={styles.overlay} pointerEvents="box-none">
              {/* === 1) MASK PRIMERO (al fondo) === */}
              <View style={styles.mask} pointerEvents="none">
                <View style={styles.maskTop} />
                <View style={styles.maskMiddle}>
                  <View style={styles.maskSide} />
                  <View style={[styles.focusBox, { width: BOX, height: BOX, borderColor: colors.primary600 }]}>
                    <Animated.View style={[styles.scanLine, { width: BOX - 12, transform: [{ translateY: scanY }] }]} />
                  </View>
                  <View style={styles.maskSide} />
                </View>
                <View style={styles.maskBottom} />
              </View>

              {/* === 2) Elementos encima, nítidos === */}
              <Body color="inverse" weight="bold" style={[styles.appTitle, {fontSize: rem * 2.5 }]}>SANTA ANA APP</Body>

              <View style={styles.tipBubble}>
                <Body color="inverse" weight="bold" style={{ textAlign: "center", fontSize: rem * 1.25 }}>
                  Alinea el QR dentro del recuadro
                </Body>
              </View>

              <View style={styles.bottomArea} pointerEvents="box-none">
                <View style={styles.statusPill}>
                  {statusText ? (
                    <Body color="inverse" weight="bold">{statusText}</Body>
                  ) : (
                    <>
                      <ActivityIndicator />
                      <Body color="inverse" weight="bold" style={{ marginLeft: 8 }}>Escaneando…</Body>
                    </>
                  )}
                </View>

                <View style={styles.buttonsRow}>
                  <Button
                    title={torch ? "Apagar linterna" : "Encender linterna"}
                    onPress={() => setTorch(t => !t)}
                    variant="ghost"
                  />
                  <Button title="Cerrar" onPress={onClose} variant="ghost" />
                </View>

                <Body color="inverse" style={styles.copyright}>
                  © 2019 Compañía Agrícola Industrial Santa Ana, S. A. - All Rights Reserved
                </Body>
              </View>
            </View>
          </>
        ) : (
          <View style={[styles.center, { padding: 24 }]}>
            <Body style={{ textAlign: "center", marginBottom: 12 }}>
              Necesitamos permiso de cámara para escanear el QR.
            </Body>
            <Button title="Conceder permiso" textStyle={{ color: "white" }} onPress={requestPermission} />
            <View style={{ height: 8 }} />
            <Button title="Cerrar" textStyle={{ color: "white" }} onPress={onClose} variant="ghost" />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#000" },
  camera: { ...StyleSheet.absoluteFillObject },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-start",
  },

  appTitle: {
    marginTop: 48,
    fontSize: 20,
    textAlign: "center",
    color: "#fff",
  },

  tipBubble: {
    marginTop: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },

  // Máscara con hueco
  mask: { ...StyleSheet.absoluteFillObject },
  maskTop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  maskMiddle: { height: 320, flexDirection: "row" },
  maskSide: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  focusBox: {
    alignSelf: "center",
    borderWidth: 3,
    borderRadius: 18,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  maskBottom: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },

  scanLine: {
    position: "absolute",
    height: 2,
    backgroundColor: "#fff",
    opacity: 0.9,
    top: "50%",
    left: 6,
  },

  bottomArea: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 24,
  },

  statusPill: {
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  buttonsRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 24,
  },

  copyright: {
    textAlign: "center",
    opacity: 0.9,
    fontSize: 12,
    color: "#fff",
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
