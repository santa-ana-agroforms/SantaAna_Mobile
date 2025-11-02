// src/components/atoms/Label.tsx
import { Body } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import React, { useMemo } from "react";
import { StyleSheet, Text, View, ViewStyle, useWindowDimensions } from "react-native";

type Frame = { width: number; height: number };

type Props = {
  /** Texto principal de la etiqueta */
  text?: string;
  /** Muestra asterisco si es requerido */
  required?: boolean;
  /** Texto de ayuda opcional debajo del label */
  help?: string;
  /** Escala base: usualmente el referenceFrame del PageScaffold */
  frame?: Frame;
  /** Estilos del contenedor externo */
  style?: ViewStyle;
  /** Color del asterisco (por defecto danger600) */
  requiredColor?: string;
  /** Separación inferior del bloque (si no se define, se calcula) */
  marginBottom?: number;
  /** Si es encabezado de grupo: centra el texto y muestra divisor inferior */
  isGroup?: boolean;
  /** Personaliza el divisor (sólo si isGroup=true) */
  dividerColor?: string;
  dividerThickness?: number; // px
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const Label: React.FC<Props> = ({
  text,
  required,
  help,
  frame,
  style,
  requiredColor = colors.danger600,
  marginBottom,
  isGroup = false,
  dividerColor = colors.textTertiary,
  dividerThickness, // si no se pasa, usamos hairline
}) => {
  const { width: ww, height: hh } = useWindowDimensions();
  const baseFrame = frame ?? { width: ww, height: hh };

  const dims = useMemo(() => {
    const minSide = Math.min(baseFrame.width, baseFrame.height);
    const baseRem = clamp(minSide * 0.042, 14, 18);
    const blockMB = clamp(minSide * 0.008, 6, 12);
    const helpTop = clamp(minSide * 0.004, 4, 8);
    const dividerTop = clamp(minSide * 0.008, 6, 12);
    return { baseRem, blockMB, helpTop, dividerTop };
  }, [baseFrame.height, baseFrame.width]);

  if (!text) return null;

  const containerAlign = isGroup ? { alignItems: "center" as const } : null;
  const textAlign = isGroup ? { textAlign: "center" as const } : null;
  const dividerH = dividerThickness ?? StyleSheet.hairlineWidth;

  return (
    <View style={[{ marginBottom: marginBottom ?? dims.blockMB }, containerAlign, style]}>
      <Body
        color="tertiary"
        weight="semibold"
        size={isGroup ? "md" : "sm"}
        style={textAlign ?? undefined}
      >
        {isGroup ? "Grupo: " + text : text}
        {required ? (
          <Text allowFontScaling={false} style={{ color: requiredColor }}>
            {" "}
            *
          </Text>
        ) : null}
      </Body>

      {help && !isGroup ? (
        <Body
          color="secondary"
          size="sm"
          style={[{ marginTop: dims.helpTop }, textAlign ?? undefined]}
          frame={frame}
        >
          {help}
        </Body>
      ) : null}

      {isGroup ? (
        <View
          style={{
            marginTop: dims.dividerTop,
            alignSelf: "stretch",
            height: dividerH,
            backgroundColor: dividerColor,
            opacity: 0.9,
          }}
        />
      ) : null}
    </View>
  );
};

export default Label;
