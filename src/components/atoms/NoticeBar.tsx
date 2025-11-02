import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, Text, View, useWindowDimensions } from "react-native";

export type NoticeKind = "success" | "info" | "warning" | "error";
type Placement = "top" | "bottom";

type Props = {
  kind: NoticeKind;
  text: string;
  onClose?: () => void;
  autoHideMs?: number;
  /** Posición del banner: "top" o "bottom" (default: bottom) */
  placement?: Placement;
  /** Offset adicional en px desde el borde (usa SafeArea para top) */
  topInsetPx?: number;
  bottomInsetPx?: number;
};

const kindStyle = (k: NoticeKind) => {
  switch (k) {
    case "success":
      return { bg: "#E7F6ED", fg: "#176B3A", icon: "checkmark-circle" as const };
    case "info":
      return { bg: "#EAF3FF", fg: "#1B5FBF", icon: "information-circle" as const };
    case "warning":
      return { bg: "#FFF6E5", fg: "#8B5E00", icon: "alert-circle" as const };
    case "error":
      return { bg: "#FDEBEC", fg: "#A3222B", icon: "warning" as const };
  }
};

const NoticeBar: React.FC<Props> = ({
  kind,
  text,
  onClose,
  autoHideMs,
  placement = "bottom",
  topInsetPx,
  bottomInsetPx,
}) => {
  const anim = useRef(new Animated.Value(0)).current; // 0 oculto, 1 visible
  const { width, height } = useWindowDimensions();
  const minSide = Math.min(width, height);

  // Escalas basadas en minSide (sin clamp)
  const padH = minSide * 0.032;
  const padV = minSide * 0.022;
  const corner = minSide * 0.028;
  const gap = minSide * 0.018;
  const fontSize = minSide * 0.04;
  const iconSize = minSide * 0.05;
  const hit = minSide * 0.02;
  const insetLR = minSide * 0.03;
  const insetTop = topInsetPx ?? minSide * 0.02;
  const insetBottom = bottomInsetPx ?? minSide * 0.025;
  const slide = minSide * 0.05;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (autoHideMs && autoHideMs > 0) {
      const t = setTimeout(() => handleClose(), autoHideMs);
      return () => clearTimeout(t);
    }
  }, [anim, autoHideMs]);

  const handleClose = () => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onClose?.());
  };

  const s = kindStyle(kind);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: placement === "top" ? [-slide, 0] : [slide, 0],
  });

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 9999,
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          left: insetLR,
          right: insetLR,
          ...(placement === "top" ? { top: insetTop } : { bottom: insetBottom }),
          transform: [{ translateY }],
          opacity: anim,
        }}
      >
        <View
          style={{
            backgroundColor: s.bg,
            borderColor: s.fg,
            borderWidth: 1,
            borderRadius: corner,
            paddingVertical: padV,
            paddingHorizontal: padH,
            flexDirection: "row",
            alignItems: "center",
            gap,
            // Sombras suaves
            shadowColor: "#000",
            shadowOpacity: 0.08,
            shadowOffset: { width: 0, height: minSide * 0.012 },
            shadowRadius: minSide * 0.03,
            elevation: 3,
          }}
        >
          <Ionicons name={s.icon} size={iconSize} color={s.fg} />
          <Text style={{ flex: 1, color: s.fg, fontWeight: "700", fontSize }}>{text}</Text>
          <Pressable
            onPress={handleClose}
            hitSlop={hit}
            style={{ paddingHorizontal: hit * 0.6, paddingVertical: hit * 0.4 }}
          >
            <Ionicons name="close" size={iconSize * 0.8} color={s.fg} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
};

export default NoticeBar;
