// app/index.tsx
import Button from "@/components/atoms/Button";
import PageScaffold from "@/components/templates/PageScaffold";
import { View } from "react-native";
import "../global.css";
import Input from "@/components/atoms/Input";
import Badge from "@/components/atoms/Badge";
import { Body } from "@/components/atoms/Typography";

export default function Home() {
  return (
    <PageScaffold title="Calidad de corte manual">
      <View style={{ gap: 12 }}>
        <Body color="secondary">Probando tipografías, botones e inputs.</Body>
        <Badge text="Demo UI foundations" />

        <Input label="Nombre" placeholder="Ingrese su nombre" />
        <Input
          label="Correo"
          placeholder="correo@dominio.com"
          keyboardType="email-address"
        />
        <Input
          label="Campo con error"
          placeholder="..."
          error="Este campo es obligatorio"
        />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Button title="PRIMARIO" />
          <Button title="GHOST" variant="ghost" />
          <Button title="PELIGRO" variant="danger" />
        </View>
        <Button title="GUARDAR" size="lg" />
      </View>
    </PageScaffold>
  );
}
