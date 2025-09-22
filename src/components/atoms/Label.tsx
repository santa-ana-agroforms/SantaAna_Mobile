// src/components/atoms/FieldLabel.tsx
import { Body } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import React, { useMemo } from "react";
import { Text, View, ViewStyle, useWindowDimensions } from "react-native";

type Frame = { width: number; height: number };

type Props = {
  /** Texto principal de la etiqueta */
  text?: string;
  /** Muestra asterisco rojo si es requerido */
  required?: boolean;
  /** Texto de ayuda opcional debajo del label */
  help?: string;
  /** Escala base: usualmente el referenceFrame del PageScaffold */
  frame?: Frame;
  /** Estilos para el contenedor externo (controla, por ejemplo, marginBottom desde el padre) */
  style?: ViewStyle;
  /** Color del asterisco (por defecto danger600) */
  requiredColor?: string;
  /** Separación inferior del bloque (si no se define, se calcula por frame) */
  marginBottom?: number;
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const Label: React.FC<Props> = ({
  text,
  required,
  frame,
  style,
  requiredColor = colors.danger600,
  marginBottom,
}) => {
  // Fallback si no pasan frame
  const { width: ww, height: hh } = useWindowDimensions();
  const baseFrame = frame ?? { width: ww, height: hh };

  const dims = useMemo(() => {
    const minSide = Math.min(baseFrame.width, baseFrame.height);
    // baseRem ~16 en teléfonos medianos
    const baseRem = clamp(minSide * 0.042, 14, 18);

    const blockMB = clamp(minSide * 0.008, 6, 12); // separación inferior del bloque
    const helpTop = clamp(minSide * 0.004, 4, 8); // separación entre label y help

    // Body internamente escala por frame; aquí solo definimos gaps
    return { baseRem, blockMB, helpTop };
  }, [baseFrame.height, baseFrame.width]);
  if (!text) return null;
  return (
    <View style={[{ marginBottom: marginBottom ?? dims.blockMB }, style]}>
      <Body color="tertiary" weight="semibold" size="sm">
        {text}
        {required ? <Text style={{ color: requiredColor }}> *</Text> : null}
      </Body>
    </View>
  );
};

export default Label;
