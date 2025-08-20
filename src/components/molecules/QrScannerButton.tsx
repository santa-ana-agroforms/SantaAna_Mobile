// QrLoginScanner.tsx
import Button from "@/components/atoms/Button"; // tu botón
import { Body } from "@/components/atoms/Typography"; // tu tipografía
import { useResponsive } from "@/hooks/useResponsive"; // tu hook
import { colors } from "@/theme/tokens"; // tus colores
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import React, { useCallback, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

type QrPayload = { sid: string; nonce: string; sig: string };

const isQrPayload = (x: unknown): x is QrPayload =>
  !!x &&
  typeof x === "object" &&
  "sid" in x &&
  typeof (x as any).sid === "string" &&
  "nonce" in x &&
  typeof (x as any).nonce === "string" &&
  "sig" in x &&
  typeof (x as any).sig === "string";

const QrLoginScanner: React.FC = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isOpen, setIsOpen] = useState(false);
  const [scannedOnce, setScannedOnce] = useState(false);

  const [parsed, setParsed] = useState<QrPayload | null>(null);
  const [raw, setRaw] = useState<string | null>(null);

  const { rem, scale } = useResponsive();

  const handleOpen = useCallback(async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) return;
    }
    setParsed(null);
    setRaw(null);
    setScannedOnce(false);
    setIsOpen(true);
  }, [permission?.granted, requestPermission]);

  const handleClose = useCallback(() => setIsOpen(false), []);

  const handleBarCodeScanned = useCallback(
    (ev: BarcodeScanningResult) => {
      if (scannedOnce) return; // evitar múltiples lecturas
      setScannedOnce(true);

      const data = ev.data ?? "";
      try {
        const obj = JSON.parse(data);
        if (isQrPayload(obj)) {
          setParsed(obj);
        } else {
          setRaw(data); // estructura inesperada
        }
      } catch {
        setRaw(data); // no era JSON
      } finally {
        setIsOpen(false);
      }
    },
    [scannedOnce]
  );

  const prettyJson = useMemo(
    () => (parsed ? JSON.stringify(parsed, null, 2) : raw ?? ""),
    [parsed, raw]
  );

  return (
    <View style={[styles.container, { padding: scale(16) }]}>
      {!isOpen && (
        <>
          <Button
            title="Escanear QR"
            onPress={handleOpen}
            variant="primary"
            size="lg"
          />

          {(parsed || raw) && (
            <View style={[styles.card, { borderColor: colors.border }]}>
              <Body
                weight="bold"
                style={{
                  fontSize: rem * 1.6,
                  marginBottom: 6,
                  color: colors.textPrimary,
                }}
              >
                Resultado del QR
              </Body>

              {parsed ? (
                <>
                  <KeyValue label="sid" value={parsed.sid} />
                  <KeyValue label="nonce" value={parsed.nonce} />
                  <KeyValue label="sig" value={parsed.sig} />
                </>
              ) : (
                <View style={styles.codeBlock}>
                  <Text
                    selectable
                    style={[
                      styles.codeText,
                      { fontSize: rem * 1.25, color: colors.textPrimary },
                    ]}
                  >
                    {prettyJson}
                  </Text>
                </View>
              )}

              <View style={{ height: 12 }} />
              <Button title="Reintentar" onPress={handleOpen} variant="ghost" />
            </View>
          )}
        </>
      )}

      {isOpen && (
        <View style={styles.cameraWrap}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarCodeScanned}
          >
            {/* Overlay */}
            <View style={styles.overlayTop} />
            <View style={styles.overlayMiddle}>
              <View style={styles.overlaySide} />
              <View
                style={[styles.focusBox, { borderColor: colors.primary600 }]}
              />
              <View style={styles.overlaySide} />
            </View>
            <View style={styles.overlayBottom}>
              <Body color="inverse" style={{ opacity: 0.95 }}>
                Apuntá al código QR
              </Body>
              <View style={{ height: 8 }} />
              <Button title="Cerrar" onPress={handleClose} variant="ghost" />
            </View>
          </CameraView>
        </View>
      )}

      {/* Si no hay permiso aún, muestra un helper */}
      {permission && !permission.granted && !isOpen && (
        <Body style={{ marginTop: 12, color: colors.textSecondary }}>
          Necesitamos permiso de cámara para escanear el QR.
        </Body>
      )}
    </View>
  );
};

export default QrLoginScanner;

// Sub-componente para key/value con tu tipografía
const KeyValue = ({ label, value }: { label: string; value: string }) => (
  <View style={{ marginBottom: 8 }}>
    <Body style={{ opacity: 0.7 }}>{label}</Body>
    <Body selectable weight="bold">
      {value}
    </Body>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    width: "100%",
  },
  card: {
    marginTop: 16,
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  codeBlock: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  codeText: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }) as any,
  },
  cameraWrap: {
    width: "100%",
    height: 440,
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 12,
  },
  camera: { flex: 1 },
  overlayTop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  overlayMiddle: { height: 240, flexDirection: "row" },
  overlaySide: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  focusBox: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 12,
  },
});
