// components/qr/ScannerModal.tsx
import { colors } from "@/theme/tokens";
import { Body } from "@/components/atoms/Typography";
import Button from "@/components/atoms/Button";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as Haptics from "expo-haptics";

type Props = {
  visible: boolean;
  onClose: () => void;
  onQr: (data: string) => void; // devolvemos el string crudo y arriba lo parseas
  statusText?: string | null;   // "Verificando…", "Sincronizando…"
};

export default function ScannerModal({ visible, onClose, onQr, statusText }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [armed, setArmed] = useState(true); // anti‑rebote
  const lastScanAtRef = useRef<number>(0);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      if (!permission?.granted) await requestPermission();
    })();
  }, [visible, permission?.granted, requestPermission]);

  const handleScan = useCallback(
    async (ev: BarcodeScanningResult) => {
      if (!armed) return;
      const now = Date.now();
      if (now - lastScanAtRef.current < 1200) return; // throttle 1.2s
      lastScanAtRef.current = now;

      setArmed(false);
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onQr(ev.data ?? "");
      } finally {
        // re-armamos solo si no se cierra la modal; lo controla el contenedor
        setTimeout(() => setArmed(true), 2000);
      }
    },
    [armed, onQr]
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={styles.wrap}>
        {permission?.granted ? (
          <CameraView
            style={styles.camera}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleScan}
          >
            <View style={styles.overlayTop} />
            <View style={styles.overlayMiddle}>
              <View style={styles.overlaySide} />
              <View style={[styles.focusBox, { borderColor: colors.primary600 }]} />
              <View style={styles.overlaySide} />
            </View>

            <View style={styles.overlayBottom}>
              <Body color="inverse" weight="bold">Alinea el QR dentro del recuadro</Body>
              <View style={{ height: 6 }} />
              {statusText ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator />
                  <Body color="inverse" style={{ opacity: 0.95 }}>{statusText}</Body>
                </View>
              ) : null}
              <View style={{ height: 12 }} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button title={torch ? "Apagar linterna" : "Encender linterna"} onPress={() => setTorch(t => !t)} variant="ghost" />
                <Button title="Cerrar" onPress={onClose} variant="ghost" />
              </View>
            </View>
          </CameraView>
        ) : (
          <View style={[styles.center, { padding: 24 }]}>
            <Body style={{ textAlign: "center", marginBottom: 12 }}>
              Necesitamos permiso de cámara para escanear el QR.
            </Body>
            <Button title="Conceder permiso" onPress={requestPermission} />
            <View style={{ height: 8 }} />
            <Button title="Cerrar" onPress={onClose} variant="ghost" />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  overlayTop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  overlayMiddle: { height: 260, flexDirection: "row" },
  overlaySide: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  focusBox: { width: 260, height: 260, borderWidth: 3, borderRadius: 18, backgroundColor: "transparent" },
  overlayBottom: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", paddingBottom: 16,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
