// src/components/molecules/FormListItem.tsx
import IconButton from "@/components/atoms/IconButton";
import { Body } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import React, { useMemo } from "react";
import { Image, ImageSourcePropType, Pressable, StyleSheet, View, ViewStyle } from "react-native";

type Frame = { width: number; height: number };

type Props = {
  title: string;
  statusText: string;
  statusColor: string;
  assignedAt?: Date | null;
  availableUntil?: Date | null;
  onPress?: () => void;

  // Layout base
  referenceFrame: Frame;
  contentFrame: Frame;

  // Opcionales de UI
  leadingIcon?: ImageSourcePropType;
  enterIcon?: ImageSourcePropType;
  style?: ViewStyle;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const baseStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral0,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
});

const StatusDot: React.FC<{ color?: string; size?: number }> = ({ color = "#888", size = 8 }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: 999,
      backgroundColor: color,
      marginLeft: 6,
      marginBottom: 1,
    }}
  />
);

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const formatFechaCorta = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

const FormListItem: React.FC<Props> = ({
  title,
  statusText,
  statusColor,
  assignedAt,
  availableUntil,
  onPress,
  referenceFrame,
  contentFrame,
  leadingIcon = require("../../../assets/images/form.png"),
  enterIcon = require("../../../assets/images/enter.png"),
  style,
}) => {
  const { padCard, padRight, minCardHeight, rowGap, iconSize, statusDotSize, enterBtnSize } =
    useMemo(() => {
      const minSide = Math.min(referenceFrame.width, referenceFrame.height);
      const gapY = clamp(contentFrame.width * 0.04, 12, 24);
      const _pad = clamp(minSide * 0.02, 12, 20);
      const _titleSize = clamp(minSide * 0.038, 16, 22);
      const _rowGap = clamp(minSide * 0.012, 6, 12);
      const _iconSize = clamp(minSide * 0.055, 18, 24);
      const _statusDot = clamp(minSide * 0.012, 6, 10);
      const _minH = clamp(minSide * 0.12, 72, 104);
      const _enter = clamp(minSide * 0.055, 28, 40);

      return {
        padCard: _pad,
        padRight: _pad + _enter + gapY * 0.5,
        minCardHeight: _minH,
        rowGap: _rowGap,
        iconSize: _iconSize,
        titleSize: _titleSize,
        statusDotSize: _statusDot,
        enterBtnSize: _enter,
      };
    }, [referenceFrame, contentFrame]);

  return (
    <Pressable
      onPress={onPress}
      style={[
        baseStyles.card,
        {
          padding: padCard,
          paddingRight: padRight,
          minHeight: minCardHeight,
        },
        style,
      ]}
    >
      {/* Título */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: rowGap,
          marginBottom: rowGap * 0.75,
        }}
      >
        <Image
          source={leadingIcon}
          style={{ width: iconSize, height: iconSize, marginTop: 2 }}
          resizeMode="contain"
        />
        <Body size="sm" color="tertiary" weight="bold">
          {title}
        </Body>
      </View>

      {/* Estado + asignación */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: rowGap * 0.25,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Body frame={referenceFrame} weight="bold" size="xs">
            {statusText}
          </Body>
          <StatusDot size={statusDotSize} color={statusColor} />
        </View>

        {assignedAt ? (
          <Body frame={referenceFrame} color="secondary" size="xs">
            Asignado el {formatFechaCorta(assignedAt)}
          </Body>
        ) : null}
      </View>

      {/* Disponible hasta */}
      {availableUntil ? (
        <Body frame={referenceFrame} color="secondary" size="xs">
          Disponible hasta el {formatFechaCorta(availableUntil)} 🕒
        </Body>
      ) : null}

      {/* Icono de acceso (decorativo) */}
      <View
        style={{
          position: "absolute",
          right: padCard,
          top: 0,
          bottom: 0,
          justifyContent: "center",
        }}
        pointerEvents="none"
      >
        <IconButton
          frame={referenceFrame}
          size={enterBtnSize}
          iconSize={iconSize}
          iconSource={enterIcon}
          disabled
          showShadow={false}
        />
      </View>
    </Pressable>
  );
};

export default FormListItem;
