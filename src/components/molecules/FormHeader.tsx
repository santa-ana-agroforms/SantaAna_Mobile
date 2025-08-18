import { View } from "react-native";
import { Title, Body } from "@/components/atoms/Typography";
import IconButton from "@/components/atoms/IconButton";
import PaginationDots from "@/components/atoms/PaginationDots";
import StatusDot from "@/components/atoms/StatusDot";
import TimestampText from "@/components/atoms/TimestampText";
import { useResponsive } from "@/hooks/useResponsive";

type Props = {
  title: string;
  page: number;      // 1-based
  totalPages: number;
  connected?: boolean;
  onBack?: () => void;
  onRefresh?: () => void;
};

export default function FormHeader({
  title,
  page,
  totalPages,
  connected = true,
  onBack,
  onRefresh,
}: Props) {
  const { gutter } = useResponsive();

  return (
    <View style={{ gap: gutter * 0.75 }}>
      {/* fila superior */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton accessibilityLabel="Atrás" onPress={onBack} iconSource={require("../../../assets/images/return.png")} />
        <Title style={{ flex: 1 }}>{title}</Title>
      </View>

      {/* dots + page */}
      <View style={{ alignItems: "center", gap: 4 }}>
        <PaginationDots total={totalPages} activeIndex={Math.max(0, Math.min(totalPages - 1, page - 1))} />
        <Body color="secondary">Página {page} de {totalPages}</Body>
      </View>

      {/* separador */}
      <View style={{ height: 2, backgroundColor: "#000000ff", opacity: 0.7 }} />

      {/* estado */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <TimestampText date={new Date()} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Body color="secondary">{connected ? "Conectado" : "Sin conexión"}</Body>
            <StatusDot status={connected ? "online" : "offline"} />
          </View>
        </View>
        <IconButton accessibilityLabel="Sincronizar" onPress={onRefresh} iconSource={require("../../../assets/images/sync.png")} />
      </View>
    </View>
  );
}
