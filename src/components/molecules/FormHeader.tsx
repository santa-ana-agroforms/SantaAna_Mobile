import IconButton from "@/components/atoms/IconButton";
import PaginationDots from "@/components/atoms/PaginationDots";
import StatusDot from "@/components/atoms/StatusDot";
import TimestampText from "@/components/atoms/TimestampText";
import { Body, Title } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import React, { memo, useMemo } from "react";
import { View, useWindowDimensions } from "react-native";

type VariantH = "categories" | "groups" | "form";
type Frame = { width: number; height: number };

type Props = {
  title: string;
  page: number; // 1-based
  totalPages: number;
  connected?: boolean;
  lastUpdatedAt?: Date; // ⬅️ NUEVO: viene de PageScaffold cuando presionas refresh
  onBack?: () => void;
  onRefresh?: () => void;
  variant: VariantH;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  onGoToPage?: (page1Based: number) => void;
  frame?: Frame;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const FormHeader: React.FC<Props> = ({
  title,
  page,
  totalPages,
  connected = true,
  lastUpdatedAt,
  onBack,
  onRefresh,
  variant,
  onPrevPage,
  onNextPage,
  onGoToPage,
  frame,
}) => {
  const { width: ww, height: hh } = useWindowDimensions();
  const baseFrame = frame ?? { width: ww, height: hh };

  const {
    padX,
    padTop,
    rowGap,
    titleSize,
    titleSizeCategories,
    dotsGap,
    dotsShiftUp,
    titleCatSize,
  } = useMemo(() => {
    const minSide = Math.min(baseFrame.width, baseFrame.height);
    const _padX = clamp(baseFrame.width * 0.04, 12, 24);
    const _padTop = variant === "categories" ? baseFrame.height * 0.015 : baseFrame.height * 0.022;
    const _rowGap = clamp(baseFrame.width * 0.03, 8, 16);
    const _titleSize = minSide * 0.055;
    const titleCatSize = minSide * 0.045;
    const _titleSizeCategories = minSide * 0.065;
    const _dotsGap = clamp(minSide * 0.012, 6, 12);
    const _dotsShiftUp = minSide * -0.005;
    return {
      padX: _padX,
      padTop: _padTop,
      rowGap: _rowGap,
      titleSize: _titleSize,
      titleSizeCategories: _titleSizeCategories,
      dotsGap: _dotsGap,
      titleCatSize,
      dotsShiftUp: _dotsShiftUp,
    };
  }, [baseFrame.height, baseFrame.width, variant]);

  const activeIndex = Math.max(0, Math.min(totalPages - 1, page - 1));
  const showPagination = variant === "form" && totalPages > 1;

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
              frame={baseFrame}
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

        {showPagination ? (
          <View style={{ alignItems: "center", gap: dotsGap, marginTop: dotsShiftUp }}>
            <PaginationDots
              total={totalPages}
              activeIndex={activeIndex}
              arrows={totalPages >= 2}
              pill
              onChange={(nextIndex) => {
                if (onGoToPage) return onGoToPage(nextIndex + 1);
                if (nextIndex < activeIndex) onPrevPage?.();
                else if (nextIndex > activeIndex) onNextPage?.();
              }}
            />
            <Body color="secondary" size="xs" style={{ marginTop: dotsShiftUp * 2 }}>
              Página {activeIndex + 1} de {totalPages}
            </Body>
          </View>
        ) : null}

        {/* separador */}
        {variant !== "categories" ? (
          <View
            style={{
              height: hh * 0.001,
              backgroundColor: colors.textPrimary,
              opacity: 1,
              marginVertical: rowGap * 0.4,
            }}
          />
        ) : null}

        {/* estado conexión + sync (solo fuera de 'form') */}
        {variant !== "form" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: dotsGap }}>
            <View style={{ flex: 1 }}>
              {/* Usa el último refresh recibido; si no hay, muestra un fallback */}
              {lastUpdatedAt ? (
                <TimestampText date={lastUpdatedAt} />
              ) : (
                <Body color="secondary" size="sm">
                  Aún no has sincronizado ⚠️
                </Body>
              )}
              <View style={{ flexDirection: "row", alignItems: "center", gap: dotsGap * 0.75 }}>
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
              frame={baseFrame}
            />
          </View>
        ) : null}

        {variant === "categories" ? (
          <>
            <View style={{ alignItems: "center", marginTop: rowGap * 0.1 }}>
              <Body color="primary" size="sm" weight="bold" style={{ fontSize: titleCatSize }}>
                Categorías de formularios disponibles
              </Body>
            </View>
            <View
              style={{
                height: hh * 0.001,
                backgroundColor: colors.textSecondary,
                opacity: 1,
                width: "90%",
                alignSelf: "center",
              }}
            />
          </>
        ) : null}
      </View>
    </View>
  );
};

export default memo(FormHeader);
