// src/components/qr/ScannerModal.tsx
import Button from "@/components/atoms/Button";
import { Body } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Modal, StyleSheet, View } from "react-native";

type Frame = { width: number; height: number };

type Props = {
  visible: boolean;
  onClose: () => void;
  onQr: (data: string) => void;
  statusText?: string | null;
  referenceFrame: Frame;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const ScannerModal: React.FC<Props> = ({ visible, onClose, onQr, statusText, referenceFrame }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [armed, setArmed] = useState(true);
  const lastScanAtRef = useRef<number>(0);

  // ===== Dimensiones derivadas del referenceFrame =====
  const {
    baseRem,
    boxSize,
    focusRadius,
    maskSideAlpha,
    scanLineH,
    scanLineInset,
    appTitleTop,
    bubblePadH,
    bubblePadV,
    bottomPad,
    buttonsPadX,
    statusPillRadius,
    pillPadH,
    pillPadV,
    copyrightFS,
    topMaskH,
    midMaskH,
    sideMaskW,
  } = useMemo(() => {
    const { width, height } = referenceFrame;
    const minSide = Math.min(width, height);

    const _baseRem = clamp(minSide * 0.042, 14, 18);
    const _box = clamp(minSide * 0.62, 220, 360);
    const _radius = clamp(minSide * 0.02, 10, 16);

    const _scanLineH = clamp(minSide * 0.003, 1, 3);
    const _scanLineInset = clamp(minSide * 0.02, 8, 14);
    const _maskAlpha = 0.55;

    const _appTitleTop = clamp(minSide * 0.08, 32, 56);
    const _bubblePadH = clamp(minSide * 0.018, 10, 16);
    const _bubblePadV = clamp(minSide * 0.012, 6, 12);

    const _bottomPad = clamp(minSide * 0.04, 16, 28);
    const _buttonsPadX = clamp(minSide * 0.04, 16, 28);

    const _pillRadius = clamp(minSide * 0.02, 10, 14);
    const _pillPadH = clamp(minSide * 0.02, 10, 16);
    const _pillPadV = clamp(minSide * 0.012, 6, 10);

    const _copyrightFS = clamp(minSide * 0.03, 11, 14);

    const _topMaskH = Math.max(0, Math.round((height - _box) / 2));
    const _midMaskH = _box;
    const _sideMaskW = Math.max(0, Math.round((width - _box) / 2));

    return {
      baseRem: _baseRem,
      boxSize: _box,
      focusRadius: _radius,
      maskSideAlpha: _maskAlpha,
      scanLineH: _scanLineH,
      scanLineInset: _scanLineInset,
      appTitleTop: _appTitleTop,
      bubblePadH: _bubblePadH,
      bubblePadV: _bubblePadV,
      bottomPad: _bottomPad,
      buttonsPadX: _buttonsPadX,
      statusPillRadius: _pillRadius,
      pillPadH: _pillPadH,
      pillPadV: _pillPadV,
      copyrightFS: _copyrightFS,
      topMaskH: _topMaskH,
      midMaskH: _midMaskH,
      sideMaskW: _sideMaskW,
    };
  }, [referenceFrame]);

  // ===== Barrido animado =====
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sweep, visible]);

  const scanY = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-(boxSize / 2) + scanLineInset, boxSize / 2 - scanLineInset],
  });

  // ===== Permisos cámara =====
  useEffect(() => {
    if (!visible) return;
    (async () => {
      if (!permission?.granted) await requestPermission();
    })();
  }, [visible, permission?.granted, requestPermission]);

  // ===== Escaneo (API nueva: codeScanner) =====
  // const handleCodes = useCallback(
  //   (codes: { value?: string }[]) => {
  //     if (!armed) return;
  //     const now = Date.now();
  //     if (now - lastScanAtRef.current < 1200) return;
  //     lastScanAtRef.current = now;

  //     const value = codes?.[0]?.value ?? "";
  //     if (!value) return;

  //     setArmed(false);
  //     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).finally(() => onQr(value));
  //     setTimeout(() => setArmed(true), 1800);
  //   },
  //   [armed, onQr]
  // );

  // // const codeScanner = useMemo(
  // //   () => ({
  // //     codeTypes: ["qr"] as const,
  // //     onCodeScanned: handleCodes,
  // //   }),
  // //   [handleCodes]
  // // );

  const maskColor = `rgba(0,0,0,${maskSideAlpha})`;

  const handleScan = useCallback(
    (ev: { data?: string }) => {
      if (!armed) return;
      const now = Date.now();
      if (now - lastScanAtRef.current < 1200) return;
      lastScanAtRef.current = now;

      const value = ev?.data ?? "";
      if (!value) return;

      setArmed(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).finally(() => onQr(value));
      setTimeout(() => setArmed(true), 1800);
    },
    [armed, onQr]
  );
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {permission?.granted ? (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              onBarcodeScanned={handleScan}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            />

            {/* Overlay absoluto */}
            <View
              style={[
                StyleSheet.absoluteFill,
                { alignItems: "center", justifyContent: "flex-start" },
              ]}
              pointerEvents="box-none"
            >
              {/* MASK */}
              <View style={[StyleSheet.absoluteFill]} pointerEvents="none">
                <View style={{ height: topMaskH, backgroundColor: maskColor }} />
                <View style={{ height: midMaskH, flexDirection: "row" }}>
                  <View style={{ width: sideMaskW, backgroundColor: maskColor }} />
                  <View
                    style={{
                      width: boxSize,
                      height: boxSize,
                      alignSelf: "center",
                      borderWidth: clamp(baseRem * 0.14, 2, 4),
                      borderRadius: focusRadius,
                      borderColor: colors.primary600,
                      backgroundColor: "transparent",
                      overflow: "hidden",
                    }}
                  >
                    <Animated.View
                      style={{
                        position: "absolute",
                        left: scanLineInset,
                        right: scanLineInset,
                        height: scanLineH,
                        backgroundColor: "#fff",
                        opacity: 0.9,
                        top: "50%",
                        transform: [{ translateY: scanY }],
                      }}
                    />
                  </View>
                  <View style={{ width: sideMaskW, backgroundColor: maskColor }} />
                </View>
                <View style={{ flex: 1, backgroundColor: maskColor }} />
              </View>

              {/* UI superior */}
              <Body
                color="inverse"
                weight="bold"
                style={{
                  marginTop: appTitleTop,
                  fontSize: clamp(baseRem * 2.0, 18, 28),
                  textAlign: "center",
                }}
                frame={referenceFrame}
              >
                - Santa Ana -
              </Body>

              <View
                style={{
                  marginTop: baseRem * 9.5,
                  backgroundColor: "rgba(0,0,0,0.65)",
                  paddingHorizontal: bubblePadH,
                  paddingVertical: bubblePadV,
                  borderRadius: clamp(baseRem * 0.7, 10, 14),
                }}
              >
                <Body
                  color="inverse"
                  weight="bold"
                  style={{ textAlign: "center", fontSize: clamp(baseRem * 1.1, 12, 18) }}
                  frame={referenceFrame}
                >
                  Alinea el QR dentro del recuadro
                </Body>
              </View>

              {/* UI inferior */}
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { justifyContent: "flex-end", alignItems: "center", paddingBottom: bottomPad },
                ]}
                pointerEvents="box-none"
              >
                <View
                  style={{
                    backgroundColor: "rgba(0,0,0,0.65)",
                    borderRadius: statusPillRadius,
                    paddingHorizontal: pillPadH,
                    paddingVertical: pillPadV,
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: baseRem * 8,
                  }}
                >
                  {statusText ? (
                    <Body color="inverse" weight="bold" frame={referenceFrame}>
                      {statusText}
                    </Body>
                  ) : (
                    <>
                      <ActivityIndicator />
                      <Body
                        color="inverse"
                        weight="bold"
                        style={{ marginLeft: clamp(baseRem * 0.4, 6, 10) }}
                        frame={referenceFrame}
                      >
                        Escaneando…
                      </Body>
                    </>
                  )}
                </View>

                <View
                  style={{
                    width: "100%",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingHorizontal: buttonsPadX,
                    marginBottom: clamp(baseRem * 0.8, 10, 18),
                  }}
                >
                  <Button
                    title={torch ? "Apagar linterna" : "Encender linterna"}
                    onPress={() => setTorch((t) => !t)}
                    variant="ghost"
                    textStyle={{ color: "white" }}
                  />
                  <Button
                    title="Cerrar"
                    onPress={onClose}
                    variant="ghost"
                    textStyle={{ color: "white" }}
                  />
                </View>

                <Body
                  color="inverse"
                  style={{ textAlign: "center", opacity: 0.9, fontSize: copyrightFS }}
                  frame={referenceFrame}
                >
                  © 2019 Compañía Agrícola Industrial Santa Ana, S. A. - All Rights Reserved
                </Body>
              </View>
            </View>
          </>
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: clamp(baseRem * 1.2, 16, 28),
            }}
          >
            <Body
              style={{ textAlign: "center", marginBottom: clamp(baseRem * 0.6, 8, 14) }}
              frame={referenceFrame}
            >
              Necesitamos permiso de cámara para escanear el QR.
            </Body>
            <Button title="Conceder permiso" onPress={requestPermission} variant="ghost" />
            <View style={{ height: clamp(baseRem * 0.6, 8, 12) }} />
            <Button title="Cerrar" onPress={onClose} variant="ghost" />
          </View>
        )}
      </View>
    </Modal>
  );
};

export default ScannerModal;
