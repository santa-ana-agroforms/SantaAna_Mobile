// src/components/atoms/TimestampText.tsx
import { Body } from "./Typography";

const formatTime = (date: Date) => {
  // 08:45 AM en es-ES/Latam
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

const TimestampText = ({ date }: { date: Date }) => {
  return (
    <Body color="secondary" size="sm">
      Última actualización: {formatTime(date)}
    </Body>
  );
};

export default TimestampText;
