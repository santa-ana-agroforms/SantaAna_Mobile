// ============================================
// src/components/molecules/FormHeader.tsx
// (PATCH) — añade flechas prev/next alrededor de los dots cuando variant="form"
// ============================================
import React from "react";
import { View, Pressable } from "react-native";
import { Title, Body } from "@/components/atoms/Typography";
import IconButton from "@/components/atoms/IconButton";
import PaginationDots from "@/components/atoms/PaginationDots";
import StatusDot from "@/components/atoms/StatusDot";
import TimestampText from "@/components/atoms/TimestampText";
import { useResponsive } from "@/hooks/useResponsive";

type VariantH = "categories" | "groups" | "form";

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
};

export default function FormHeader({
  title,
  page,
  totalPages,
  connected = true,
  onBack,
  onRefresh,
  variant,
  onPrevPage,
  onNextPage,
}: Props) {
  const { gutter, rem } = useResponsive();

  const Arrow = ({ label, onPress }: { label: string; onPress?: () => void }) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!onPress}
      style={{
        height: rem * 1.5,
        width: rem * 1.5,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: onPress ? "#2D8A24" : "#00000022",
        opacity: onPress ? 1 : 0.6,
      }}
    >
      <Body
        style={{
          fontSize: rem * 1.5,
          color: "white",
          lineHeight: rem * 1.5,
          marginTop: -rem * 0.1,
        }}
      >
        {label}
      </Body>
    </Pressable>
  );

  return (
    <View style={{ gap: gutter * 0.75 }}>
      {/* fila superior */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {variant !== "categories" && (
          <IconButton
            accessibilityLabel="Atrás"
            onPress={onBack}
            iconSource={require("../../../assets/images/return.png")}
          />
        )}
        <Title style={{ flex: 1, fontSize: variant === "categories" ? rem * 3 : rem * 2 }}>
          {title}
        </Title>
      </View>

      {/* dots + page */}
      {variant === "form" ? (
        <View style={{ alignItems: "center", gap: 8, marginTop: rem * -1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Arrow label="‹" onPress={onPrevPage} />
            <PaginationDots
              total={totalPages}
              activeIndex={Math.max(0, Math.min(totalPages - 1, page - 1))}
            />
            <Arrow label="›" onPress={onNextPage} />
          </View>
          <Body color="secondary">
            Página {page} de {totalPages}
          </Body>
        </View>
      ) : null}

      {/* separador */}
      {variant !== "categories" && (
        <View style={{ height: 2, backgroundColor: "#000000ff", opacity: 0.7 }} />
      )}

      {/* estado */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <TimestampText date={new Date()} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Body color="secondary">{connected ? "Conectado" : "Sin conexión"}</Body>
            <StatusDot status={connected ? "online" : "offline"} />
          </View>
        </View>
        <IconButton
          accessibilityLabel="Sincronizar"
          onPress={onRefresh}
          iconSource={require("../../../assets/images/sync.png")}
        />
      </View>
    </View>
  );
}
