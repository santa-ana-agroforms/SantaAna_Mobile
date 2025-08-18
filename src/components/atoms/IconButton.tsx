import { useResponsive } from "@/hooks/useResponsive";
import { colors } from "@/theme/tokens";
import { Image, ImageSourcePropType, Pressable, StyleProp, ViewStyle } from "react-native";
import { Caption } from "./Typography";

type Props = {
  icon?: React.ReactElement;           
  iconSource?: ImageSourcePropType;    
  onPress?: () => void;
  size?: number;
  bgColor?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
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

const renderIcon = () => {
    return iconSource ? (
        <Image
            source={iconSource}
            style={{ width: rem * 3.5, height: rem * 3.5, resizeMode: "contain" }}
        />
    ) : (
        icon
    );
};

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: "rgba(0,0,0,0.1)", borderless: true }}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * 0.2,
          backgroundColor: bgColor,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 3,
          elevation: 4,
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
        {
            !icon && !iconSource ? (
                <Caption weight="semibold" color="primary">{accessibilityLabel}</Caption>
            ) : renderIcon()
        }
    </Pressable>
  );
}
