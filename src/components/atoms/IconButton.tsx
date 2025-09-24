// src/components/atoms/IconButton.tsx
import { colors } from "@/theme/tokens";
import React, { useMemo } from "react";
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import { Shadow } from "react-native-shadow-2";

type Frame = { width: number; height: number };

type Props = {
  icon?: React.ReactElement;
  iconSource?: ImageSourcePropType;
  onPress?: () => void;
  /** Tamaño externo del botón (px). Si no se pasa, se calcula desde referenceFrame. */
  size?: number;
  /** Tamaño del ícono interno (px). Si no se pasa, se calcula desde el size final. */
  iconSize?: number;
  bgColor?: string;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  /** Recomendado: pásale referenceFrame del PageScaffold / FormHeader */
  frame?: Frame;
  showShadow?: boolean;
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const IconButton: React.FC<Props> = ({
  icon,
  iconSource,
  onPress,
  size,
  iconSize,
  bgColor = colors.primary600,
  disabled = false,
  style,
  accessibilityLabel,
  frame,
  showShadow = true,
}) => {
  // Fallback si no se recibe frame
  const { width: ww, height: hh } = useWindowDimensions();
  const baseFrame = frame ?? { width: ww, height: hh };

  const { finalSize, radius, innerIconSize } = useMemo(() => {
    const minSide = Math.min(baseFrame.width, baseFrame.height);

    // Tamaño automático del botón (36–56) escalado al lado menor
    const autoSize = clamp(minSide * 0.11, 36, 56);
    const _size = size ?? autoSize;

    // Radio y tamaño del ícono derivados del size final
    const _radius = clamp(_size * 0.22, 8, 14);
    const autoIcon = clamp(_size * 1, 18, 36);
    const _iconSize = iconSize ?? autoIcon;

    return { finalSize: _size, radius: _radius, innerIconSize: _iconSize };
  }, [baseFrame.height, baseFrame.width, size, iconSize]);

  const renderIcon = () =>
    iconSource ? (
      <Image
        source={iconSource}
        style={{
          width: innerIconSize,
          height: innerIconSize,
          resizeMode: "contain",
        }}
      />
    ) : (
      (icon ?? null)
    );

  return (
    <View
      style={[
        {
          width: finalSize,
          height: finalSize,
          position: "relative",
        },
        style,
      ]}
    >
      {/* Sombra inferior */}
      {showShadow === true && (
        <Shadow
          distance={3}
          offset={[0, 6]}
          startColor="#00000029"
          endColor="#00000000"
          style={{ borderRadius: radius }}
        >
          <View
            style={{
              width: finalSize,
              height: finalSize * 0.9,
              borderRadius: radius,
              backgroundColor: "transparent",
            }}
          />
        </Shadow>
      )}

      {/* Botón con ripple y borde redondeado */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { borderRadius: radius, overflow: "hidden" },
        ]}
      >
        <Pressable
          onPress={onPress}
          disabled={disabled}
          android_ripple={{ color: "rgba(0,0,0,0.08)" }}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: radius,
              backgroundColor: bgColor,
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
        >
          {renderIcon()}
        </Pressable>
      </View>
    </View>
  );
};

export default IconButton;
