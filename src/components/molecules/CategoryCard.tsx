import Button from "@/components/atoms/Button";
import { Body, Title } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import React, { memo, useMemo } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

type Frame = { width: number; height: number };

type Props = {
  name: string;
  totalForms: number;
  completedForms: number;
  onPress: () => void;
  referenceFrame: Frame;
  style?: ViewStyle; // el contenedor (grid) define el width y posiciona
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const baseStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    justifyContent: "space-between",
  },
});

const CategoryCard: React.FC<Props> = ({
  name,
  totalForms,
  completedForms,
  onPress,
  referenceFrame,
  style,
}) => {
  // Deriva escalas SOLO desde los frames
  const { pad, spacerSm, titleSize } = useMemo(() => {
    const minSide = Math.min(referenceFrame.width, referenceFrame.height);

    // padding/spacers proporcionales (independientes del ancho externo)
    const _pad = clamp(minSide * 0.02, 12, 20);
    const _spacerSm = clamp(minSide * 0.008, 6, 12);

    // tipografía proporcional al lado menor del referenceFrame
    const _titleSize = minSide * 0.045;

    const titleSizeByLength = name.length > 20 ? minSide * 0.04 : _titleSize;

    return {
      pad: _pad,
      spacerSm: _spacerSm,
      titleSize: titleSizeByLength,
    };
  }, [referenceFrame.height, referenceFrame.width, name.length]);

  return (
    <View style={[baseStyles.card, { padding: pad }, style]}>
      <Title
        style={{
          fontSize: titleSize,
          textAlign: "center",
          color: colors.textTertiary,
        }}
      >
        {name}
      </Title>
      <View style={{ paddingVertical: spacerSm }}>
        <Body color="secondary" size="xs">
          Formularios: {totalForms}
        </Body>
        <Body color="secondary" size="xs">
          Completados: {completedForms}
        </Body>
      </View>
      <Button title="INGRESAR" size="lg" onPress={onPress} />
    </View>
  );
};

export default memo(CategoryCard);
