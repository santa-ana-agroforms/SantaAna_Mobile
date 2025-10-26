// src/components/atoms/SignaturePreview.tsx
import { colors } from "@/theme/tokens";
import React from "react";
import { Image, Text, View } from "react-native";

type Props = {
  value?: string | null; // dataURI o base64
  width?: number | string; // por defecto 100%
  height?: number; // por defecto 160
  mime?: "png" | "jpg"; // si viene pelado, qué mime asumimos
  label?: string;
};

const ensureDataUri = (raw?: string | null, mime: "png" | "jpg" = "png") => {
  if (!raw) return null;
  // si ya trae prefijo, úsalo tal cual
  if (raw.startsWith("data:image")) return raw;
  // si es base64 puro, envuélvelo
  return `data:image/${mime};base64,${raw}`;
};

const SignaturePreview: React.FC<Props> = ({
  value,
  width = "100%",
  height = 208,
  mime = "png",
  label,
}) => {
  const uri = ensureDataUri(value, mime);

  return (
    <View style={{ width: "100%" }}>
      {!!label && (
        <Text
          style={{
            color: colors.textPrimary,
            marginBottom: 6,
            fontSize: 14,
            fontWeight: "600",
          }}
        >
          {label}
        </Text>
      )}
      {uri ? (
        <Image
          source={{ uri }}
          resizeMode="contain"
          style={{
            width: typeof width === "number" ? width : "100%",
            height,
            // backgroundColor: "#FFF",
            // borderWidth: 1,
            // borderColor: colors.border,
            // borderRadius: 12,
          }}
        />
      ) : (
        <Text style={{ color: colors.textSecondary }}>(sin firma)</Text>
      )}
    </View>
  );
};

export default SignaturePreview;
