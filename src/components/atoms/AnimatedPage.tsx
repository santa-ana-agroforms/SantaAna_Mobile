// AnimatedPage.tsx
import FormPageView, { Pagina } from "@/screens/FormPage";
import { colors } from "@/theme/tokens";
import React from "react";
import { Platform, ScrollView } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

type Props = {
  index: number;
  current: any;
  width: number;
  height: number;
  padX: number;
  page: Pagina;
  formName?: string;
  referenceFrame: { width: number; height: number };
  contentFrame: { width: number; height: number };
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
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const diff = current.value - index;
    return {
      opacity: 1 - Math.min(1, Math.abs(diff)) * 0.25,
      transform: [{ translateX: diff * width * 0.25 }],
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
        />
      </ScrollView>
    </Animated.View>
  );
};

export default AnimatedPage;
