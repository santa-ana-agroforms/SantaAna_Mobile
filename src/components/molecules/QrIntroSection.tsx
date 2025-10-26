// src/components/molecules/QrIntroSection.tsx
import QrScannerButton from "@/components/atoms/QrScannerButton";
import { Body } from "@/components/atoms/Typography";
import ScannerModal from "@/components/qr/ScannerModal";
import { colors } from "@/theme/tokens";
import type { AuthUser } from "@/types";
import React, { useMemo, useState } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Frame = { width: number; height: number };

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

type Props = {
  /** Escala base (usa el lado menor para tipografías/tamaños). */
  referenceFrame: Frame;
  /** Mensajes (opcionales) */
  title?: string;
  subtitle?: string;
  /** Tamaño opcional del botón de scanner (si no, se calcula). */
  scannerSize?: number;
  /** Usuario (opcional) para mostrar la card. */
  user?: AuthUser | null;
  /** Status del login/sync para el modal del escáner. */
  statusText?: string | null;
  setStatusText: (text: string | null) => void;
  /** Callback con el string del QR leido. */
  onQr: (raw: string) => void;
  /** Estilos extra para el contenedor principal. */
  containerStyle?: ViewStyle;
};

const QrIntroSection: React.FC<Props> = ({
  referenceFrame,
  title = "Bienvenido",
  subtitle = "Presiona para escanear tu código QR",
  scannerSize,
  user,
  statusText,
  setStatusText,
  onQr,
  containerStyle,
}) => {
  const [open, setOpen] = useState(false);

  const { pad, baseRem, titleSize, subtitleTop, finalScannerSize, cardStyle, rolesGapTop } =
    useMemo(() => {
      const minSide = Math.min(referenceFrame.width, referenceFrame.height);
      const _pad = clamp(minSide * 0.02, 12, 20);
      const _baseRem = clamp(minSide * 0.042, 14, 18);

      return {
        pad: _pad,
        baseRem: _baseRem,
        titleSize: clamp(_baseRem * 2.0, 18, 28),
        subtitleTop: _baseRem * 0.4,
        heroSize: clamp(minSide * 0.45, 180, 280),
        finalScannerSize: scannerSize ?? clamp(minSide * 0.52, 200, 320),

        cardStyle: {
          marginTop: _pad,
          width: "100%",
          borderRadius: clamp(minSide * 0.018, 10, 16),
          borderWidth: clamp(minSide * 0.0012, StyleSheet.hairlineWidth, 2),
          borderColor: colors.border,
          padding: _pad,
          backgroundColor: colors.surface,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: clamp(minSide * 0.012, 3, 10),
          shadowOffset: {
            width: 0,
            height: Math.max(1, Math.round(clamp(minSide * 0.012, 3, 10) / 2)),
          },
          elevation: Math.round(clamp(minSide * 0.006, 2, 6)),
        } as ViewStyle,

        rolesGapTop: clamp(minSide * 0.006, 4, 10),
      };
    }, [referenceFrame, scannerSize]);

  return (
    <SafeAreaView style={{ width: "100%", marginTop: pad }} edges={["bottom", "left", "right"]}>
      <View style={[{ width: "100%", paddingHorizontal: pad * 0 }, containerStyle]}>
        <Body
          frame={referenceFrame}
          weight="bold"
          style={{ fontSize: titleSize, textAlign: "center" }}
        >
          {title}
        </Body>
        <Body
          frame={referenceFrame}
          color="secondary"
          style={{ textAlign: "center", marginTop: subtitleTop }}
        >
          {subtitle}
        </Body>

        {/* Botón escáner */}
        <View style={{ marginTop: baseRem * 1.5, alignItems: "center" }}>
          <QrScannerButton size={finalScannerSize} onPress={() => setOpen(true)} />
        </View>

        {/* Card usuario (opcional) */}
        {user ? (
          <View style={cardStyle}>
            <Body frame={referenceFrame} weight="bold" style={{ marginBottom: rolesGapTop }}>
              Usuario
            </Body>
            <Body frame={referenceFrame}>
              Nombre:{" "}
              <Body frame={referenceFrame} selectable weight="bold">
                {user.nombre}
              </Body>
            </Body>
            <Body frame={referenceFrame}>
              Usuario:{" "}
              <Body frame={referenceFrame} selectable weight="bold">
                {user.nombre_de_usuario}
              </Body>
            </Body>
            {!!user.roles?.length && (
              <>
                <Body frame={referenceFrame} style={{ opacity: 0.7, marginTop: rolesGapTop }}>
                  Roles
                </Body>
                {user.roles.map((r) => (
                  <Body frame={referenceFrame} key={r.id}>
                    • {r.nombre} (id: {r.id})
                  </Body>
                ))}
              </>
            )}
          </View>
        ) : null}

        {/* Modal del escáner */}
        <ScannerModal
          visible={open}
          onClose={() => {
            setOpen(false);
            setStatusText(null);
          }}
          onQr={onQr}
          statusText={statusText}
          referenceFrame={referenceFrame}
        />
      </View>
    </SafeAreaView>
  );
};

export default QrIntroSection;
