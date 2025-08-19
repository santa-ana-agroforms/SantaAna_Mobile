import { useResponsive } from "@/hooks/useResponsive";
import { colors } from "@/theme/tokens";
import { Image, ImageSourcePropType, Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { Shadow } from "react-native-shadow-2";

type Props = {
  icon?: React.ReactElement;
  iconSource?: ImageSourcePropType;
  onPress?: () => void;
  size?: number;
  bgColor?: string;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export default function IconButton({
  icon,
  iconSource,
  onPress,
  size = 44,
  bgColor = colors.primary600,
  disabled = false,
  style,
  accessibilityLabel,
}: Props) {
  const { rem } = useResponsive();
  const radius = size * 0.2;

  const renderIcon = () =>
    iconSource ? (
      <Image source={iconSource} style={{ width: rem * 3.5, height: rem * 3.5, resizeMode: "contain" }} />
    ) : (
      icon
    );

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          position: "relative",
          opacity: disabled ? 0.6 : 1
        },
        style,
      ]}
    >
      <Shadow
        distance={3}
        offset={[0, 6]}
        startColor="#00000029"
        endColor="#00000000"
        style={{ borderRadius: radius }}
      >
        <View style={{ width: size, height: size * 0.9, borderRadius: radius, backgroundColor: "transparent" }} />
      </Shadow>

      {/* CONTENEDOR del botón (clip del ripple), encima */}
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: radius, overflow: "hidden" }]}>
        <Pressable
          onPress={onPress}
          disabled={disabled}
          android_ripple={{ color: "rgba(0,0,0,0.08)" }}
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: radius,
              backgroundColor: bgColor,
              alignItems: "center",
              justifyContent: "center",
              opacity: disabled ? 0.6 : 1,
            },
          ]}
          accessibilityLabel={accessibilityLabel}
        >
          {renderIcon()}
        </Pressable>
      </View>
    </View>
  );
}
