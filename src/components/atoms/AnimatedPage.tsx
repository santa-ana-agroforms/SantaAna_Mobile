import FormPageView, { Pagina } from "@/screens/FormPage";
import { colors } from "@/theme/tokens";
import React from "react";
import { Platform, ScrollView } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";

type Props = {
  index: number;
  current: Animated.SharedValue<number>; // índice actual (compartido)
  width: number;
  height: number;
  padX: number;
  page: Pagina;
  formName?: string;
  referenceFrame: { width: number; height: number };
  contentFrame: { width: number; height: number };
  mode?: "edit" | "review" | "view";
};

const AnimatedPage: React.FC<Props> = ({
  index,
  current,
  width,
  height,
  padX,
  page,
  formName,
  referenceFrame,
  contentFrame,
  mode,
}) => {
  // 1) Suaviza el índice de página para no depender de saltos bruscos
  const smoothed = useDerivedValue(() =>
    withTiming(current.value, { duration: 240, easing: Easing.out(Easing.cubic) })
  );

  // 2) Estilos animados con curvas de interpolación
  const animatedStyle = useAnimatedStyle(() => {
    // diff negativo = esta página está a la derecha; positivo = a la izquierda (o viceversa según tu pager)
    const diff = smoothed.value - index;

    // Parallax suave: a ±1 página movemos 12% del ancho (menos brusco que 25%)
    const translateX = interpolate(
      diff,
      [-1, 0, 1],
      [width * -0.12, 0, width * 0.12],
      Extrapolation.CLAMP
    );

    // Opacidad: caída suave, pero sin desaparecer (mín 0.8)
    const opacity = interpolate(diff, [-1, 0, 1], [0.8, 1, 0.8], Extrapolation.CLAMP);

    // Escala: las vecinas un pelín más pequeñas (profundidad)
    const scale = interpolate(diff, [-1, 0, 1], [0.98, 1, 0.98], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [{ translateX }, { scale }],
    };
  }, [width]);

  return (
    <Animated.View
      style={[{ width, height, backgroundColor: colors.surface, flex: 1 }, animatedStyle]}
    >
      <ScrollView
        style={{ flex: 1, paddingHorizontal: padX, backgroundColor: colors.surface }}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        contentInsetAdjustmentBehavior={Platform.OS === "ios" ? "always" : "never"}
        showsVerticalScrollIndicator
      >
        <FormPageView
          page={page}
          formName={formName}
          referenceFrame={referenceFrame}
          contentFrame={{ ...contentFrame, width, height }}
          mode={mode}
        />
      </ScrollView>
    </Animated.View>
  );
};

export default AnimatedPage;
