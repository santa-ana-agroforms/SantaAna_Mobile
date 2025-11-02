// src/components/atoms/BooleanSegment.tsx
import { Body } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import React, { useMemo } from "react";
import { Pressable, View, ViewStyle, useWindowDimensions } from "react-native";

type Frame = { width: number; height: number };

type Props = {
  /** Estado actual: true = Sí, false = No, undefined = ninguno */
  value?: boolean;
  onChange?: (v: boolean) => void;
  /** Escala derivada (recomendado: referenceFrame del Scaffold) */
  frame?: Frame;
  /** Etiquetas (por defecto Sí / No) */
  yesLabel?: string;
  noLabel?: string;
  /** Deshabilitar interacción */
  disabled?: boolean;
  /** Estilo contenedor externo */
  style?: ViewStyle;
  /** Marcar borde de error (rojo) */
  error?: boolean;
  /** Mostrar barras de realce inferiores */
  showAccentBars?: boolean;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const Boolean: React.FC<Props> = ({
  value,
  onChange,
  frame,
  yesLabel = "Sí",
  noLabel = "No",
  disabled = false,
  style,
  error = false,
  showAccentBars = true,
}) => {
  // Fallback si no pasan frame
  const { width: ww, height: hh } = useWindowDimensions();
  const baseFrame = frame ?? { width: ww, height: hh };

  const dims = useMemo(() => {
    const minSide = Math.min(baseFrame.width, baseFrame.height);
    const radius = clamp(minSide * 0.018, 8, 12);
    const padV = clamp(minSide * 0.012, 10, 16);
    const borderW = 1;
    const fontFactor = clamp(minSide * 0.042, 14, 18); // ~ baseRem
    const textSize = clamp(fontFactor * 1.0, 12, 18);
    const accentH = 2;
    const gap = 4;
    return { radius, padV, borderW, textSize, accentH, gap };
  }, [baseFrame.height, baseFrame.width]);

  const yesActive = value === true;
  const noActive = value === false;

  const borderColor = error ? colors.danger600 : colors.border;

  const yesBg = yesActive ? "rgba(45,138,36,0.12)" : colors.neutral0; // primary600 con alpha
  const noBg = noActive ? "rgba(192,57,43,0.12)" : colors.neutral0; // danger600 con alpha

  return (
    <View style={[{ opacity: disabled ? 0.6 : 1 }, style]}>
      {/* Segmento */}
      <View
        style={{
          flexDirection: "row",
          borderWidth: dims.borderW,
          borderColor,
          borderRadius: dims.radius,
          overflow: "hidden",
        }}
      >
        <Pressable
          disabled={disabled}
          onPress={() => onChange?.(true)}
          style={{
            flex: 1,
            paddingVertical: dims.padV,
            alignItems: "center",
            backgroundColor: yesBg,
            borderRightWidth: dims.borderW,
            borderRightColor: colors.border,
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: yesActive, disabled }}
          accessibilityLabel={yesLabel}
        >
          <Body
            frame={baseFrame}
            size="md"
            style={{
              color: yesActive ? colors.primary600 : colors.textPrimary,
            }}
          >
            {yesLabel}
          </Body>
        </Pressable>

        <Pressable
          disabled={disabled}
          onPress={() => onChange?.(false)}
          style={{
            flex: 1,
            paddingVertical: dims.padV,
            alignItems: "center",
            backgroundColor: noBg,
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: noActive, disabled }}
          accessibilityLabel={noLabel}
        >
          <Body
            frame={baseFrame}
            size="md"
            style={{ color: noActive ? colors.danger600 : colors.textPrimary }}
          >
            {noLabel}
          </Body>
        </Pressable>
      </View>

      {/* Barras de realce inferiores (opcional) */}
      {showAccentBars ? (
        <View style={{ flexDirection: "row", marginTop: dims.gap, gap: dims.gap }}>
          <View
            style={{
              flex: 1,
              height: dims.accentH,
              backgroundColor: yesActive ? colors.primary600 : "transparent",
            }}
          />
          <View
            style={{
              flex: 1,
              height: dims.accentH,
              backgroundColor: noActive ? colors.danger600 : "transparent",
            }}
          />
        </View>
      ) : null}
    </View>
  );
};

export default Boolean;
