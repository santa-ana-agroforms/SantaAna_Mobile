// src/components/molecules/FormHeader.tsx
import IconButton from "@/components/atoms/IconButton";
import PaginationDots from "@/components/atoms/PaginationDots";
import StatusDot from "@/components/atoms/StatusDot";
import TimestampText from "@/components/atoms/TimestampText";
import { Body, Title } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import React, { memo, useMemo } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";

type VariantH = "categories" | "groups" | "form";

type Frame = { width: number; height: number };

type Props = {
  title: string;
  page: number; // 1-based
  totalPages: number;
  connected?: boolean;
  onBack?: () => void;
  onRefresh?: () => void;
  variant: VariantH;
  onPrevPage?: () => void; // sólo form
  onNextPage?: () => void; // sólo form
  /**
   * Usa el referenceFrame que te da PageScaffold.
   * Si no lo pasas, se usará useWindowDimensions() como respaldo.
   */
  frame?: Frame;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const FormHeader: React.FC<Props> = ({
  title,
  page,
  totalPages,
  connected = true,
  onBack,
  onRefresh,
  variant,
  onPrevPage,
  onNextPage,
  frame,
}) => {
  // Fallback seguro si no recibimos frame
  const { width: ww, height: hh } = useWindowDimensions();
  const baseFrame = frame ?? { width: ww, height: hh };

  // Escalas/espaciados derivados del frame (lado menor para tipografía/íconos)
  const {
    padX,
    padTop,
    // gapUnderHeader,
    rowGap,
    titleSize,
    titleSizeCategories,
    arrowSize,
    arrowFontSize,
    dotsGap,
    dotsShiftUp,
  } = useMemo(() => {
    const minSide = Math.min(baseFrame.width, baseFrame.height);

    const _padX = clamp(baseFrame.width * 0.04, 12, 24); // padding horizontal aprox 4% (12–24)
    const _padTop = clamp(baseFrame.height * 0, 8, 24); // padding top aprox 2% (8–24)
    const _gapUnderHeader = clamp(baseFrame.height * 0.012, 8, 16);

    const _rowGap = clamp(baseFrame.width * 0.03, 8, 16); // gap fila superior (atrás/título)
    const _titleSize = clamp(minSide * 0.07, 16, 28); // título normal
    const _titleSizeCategories = clamp(minSide * 0.08, 18, 34); // título en "categories"

    const _arrowSize = clamp(minSide * 0.06, 24, 40); // círculo flechas
    const _arrowFontSize = clamp(_arrowSize * 0.8, 14, 32); // símbolo ‹ ›
    const _dotsGap = clamp(minSide * 0.012, 6, 12); // separación entre flecha–dots–flecha
    const _dotsShiftUp = -clamp(minSide * 0.02, 6, 16); // desplazar dots hacia arriba

    return {
      padX: _padX,
      padTop: _padTop,
      gapUnderHeader: _gapUnderHeader,
      rowGap: _rowGap,
      titleSize: _titleSize,
      titleSizeCategories: _titleSizeCategories,
      arrowSize: _arrowSize,
      arrowFontSize: _arrowFontSize,
      dotsGap: _dotsGap,
      dotsShiftUp: _dotsShiftUp,
    };
  }, [baseFrame.height, baseFrame.width]);

  const Arrow: React.FC<{ label: string; onPress?: () => void }> = ({ label, onPress }) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!onPress}
      style={{
        height: arrowSize,
        width: arrowSize,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: onPress ? "#2D8A24" : "#00000022",
        opacity: onPress ? 1 : 0.6,
      }}
    >
      <Body
        style={{
          fontSize: arrowFontSize,
          color: "white",
          lineHeight: arrowFontSize,
          marginTop: -arrowFontSize * 0.08,
        }}
      >
        {label}
      </Body>
    </Pressable>
  );

  return (
    <View style={{ paddingHorizontal: padX, paddingTop: padTop }}>
      <View style={{ gap: rowGap * 0.5 }}>
        {/* fila superior */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: rowGap }}>
          {variant !== "categories" && (
            <IconButton
              accessibilityLabel="Atrás"
              onPress={onBack}
              iconSource={require("../../../assets/images/return.png")}
            />
          )}
          <Title
            style={{
              flex: 1,
              fontSize: variant === "categories" ? titleSizeCategories : titleSize,
            }}
          >
            {title}
          </Title>
        </View>

        {/* dots + page (solo form) */}
        {variant === "form" ? (
          <View
            style={{
              alignItems: "center",
              gap: dotsGap,
              marginTop: dotsShiftUp,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: dotsGap,
              }}
            >
              <Arrow label="‹" onPress={onPrevPage} />
              <PaginationDots
                total={totalPages}
                activeIndex={Math.max(0, Math.min(totalPages - 1, page - 1))}
              />
              <Arrow label="›" onPress={onNextPage} />
            </View>
            <Body color="secondary" size="xs">
              Página {page} de {totalPages}
            </Body>
          </View>
        ) : null}

        {/* separador (no categories) */}
        {variant !== "categories" ? (
          <View
            style={{
              height: hh * 0.001,
              backgroundColor: colors.textPrimary,
              opacity: 1,
              marginVertical: rowGap * 0.5,
            }}
          />
        ) : null}

        {/* estado */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: dotsGap }}>
          <View style={{ flex: 1 }}>
            <TimestampText date={new Date()} />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: dotsGap * 0.75,
              }}
            >
              <Body color="secondary" size="sm">
                {connected ? "Conectado" : "Sin conexión"}
              </Body>
              <StatusDot status={connected ? "online" : "offline"} />
            </View>
          </View>
          <IconButton
            accessibilityLabel="Sincronizar"
            onPress={onRefresh}
            iconSource={require("../../../assets/images/sync.png")}
            frame={frame}
          />
        </View>
      </View>
    </View>
  );
};

export default memo(FormHeader);
