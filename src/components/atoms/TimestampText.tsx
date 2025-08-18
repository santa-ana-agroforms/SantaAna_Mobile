// src/components/atoms/TimestampText.tsx
import { Body } from "./Typography";

function formatTime(date: Date) {
  // 08:45 AM en es-ES/Latam
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export default function TimestampText({ date }: { date: Date }) {
  return (
    <Body color="secondary">
      Última actualización: {formatTime(date)}
    </Body>
  );
}
