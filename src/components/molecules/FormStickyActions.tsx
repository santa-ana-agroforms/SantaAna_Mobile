import { colors } from "@/theme/tokens";
import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

export type Frame = { width: number; height: number };

type InfoType = "info" | "success" | "error";

type InfoMessage = {
  type: InfoType;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
};

type Props = {
  referenceFrame: Frame;
  contentFrame: Frame;
  disabledSend?: boolean;
  loading?: boolean; // deshabilita botón y muestra spinner
  infoMessage?: InfoMessage | null; // banner superior con feedback
  onSendForReview: () => void; // ← se usa como “Enviar”
  sendLabel?: string; // ← por defecto ahora será "Enviar"
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const bgForType = (t: InfoType) => {
  switch (t) {
    case "success":
      return "#EAF7EA";
    case "error":
      return "#FDECEA";
    default:
      return colors.warningBg;
  }
};

const fgForType = (t: InfoType) => {
  switch (t) {
    case "success":
      return colors.primary600;
    case "error":
      return colors.danger600 ?? "#C0392B";
    default:
      return colors.textTertiary;
  }
};

const FormStickyActions: React.FC<Props> = ({
  referenceFrame,
  contentFrame,
  disabledSend = false,
  loading = false,
  infoMessage,
  onSendForReview,
  sendLabel = "Enviar",
}) => {
  const minSide = Math.min(referenceFrame.width, referenceFrame.height);
  const pad = clamp(minSide * 0.02, 12, 20);
  const gap = clamp(contentFrame.width * 0.03, 8, 16);
  const btnH = clamp(minSide * 0.064, 44, 56);
  const radius = clamp(minSide * 0.02, 10, 14);
  const titleSize = clamp(minSide * 0.038, 14, 18);

  const primaryBg = disabledSend || loading ? "#EDEDED" : colors.primary600;
  const primaryBorder = disabledSend || loading ? colors.border : colors.primary600;
  const primaryText = disabledSend || loading ? colors.textSecondary : colors.neutral0;

  return (
    <View style={{ paddingHorizontal: pad, paddingBottom: pad }}>
      {/* Banner de información/éxito/error */}
      {infoMessage && (
        <View
          style={{
            backgroundColor: bgForType(infoMessage.type),
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius,
            padding: pad * 0.8,
            marginBottom: gap,
          }}
        >
          <Text
            style={{ color: fgForType(infoMessage.type), fontWeight: "700", fontSize: titleSize }}
          >
            {infoMessage.text}
          </Text>
          {infoMessage.actionLabel && infoMessage.onAction && (
            <TouchableOpacity onPress={infoMessage.onAction} style={{ marginTop: 8 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>
                {infoMessage.actionLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius,
          padding: pad,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", gap }}>
          <TouchableOpacity
            onPress={onSendForReview}
            disabled={loading || disabledSend}
            style={{
              flex: 1,
              height: btnH,
              borderRadius: radius,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: primaryBg,
              borderWidth: 1,
              borderColor: primaryBorder,
              opacity: disabledSend || loading ? 0.85 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Text style={{ color: primaryText, fontWeight: "800" }}>{sendLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default FormStickyActions;
