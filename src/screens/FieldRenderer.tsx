import React, { useState } from "react";
import { View, TextInput, Pressable } from "react-native";
import { Title, Body } from "@/components/atoms/Typography";
import { useResponsive } from "@/hooks/useResponsive";

import Button from "@/components/atoms/Button"; // se asume existe, si no, reemplazar por Pressable
import { Campo } from "./FormPage";

// import type { Campo } from "./FormPage";

export default function FieldRenderer({ campo, formName }: { campo: Campo; formName?: string }) {
  const { rem, gutter } = useResponsive();
  const label = campo.etiqueta || campo.nombre_interno;
  const help = campo.ayuda;

  // estado simple por campo (para demo). En proyecto real, elevar a un form store.
  const [value, setValue] = useState<any>(undefined);

  const LabelRow = (
    <View style={{ marginBottom: gutter * 0.5 }}>
      <Title style={{ fontSize: rem * 1.1 }}>{label}{campo.requerido ? " *" : ""}</Title>
      {help ? <Body color="secondary">{help}</Body> : null}
    </View>
  );

  const Box = ({ children, height = 52, align = "center" as const }: { children: React.ReactNode; height?: number; align?: "center" }) => (
    <View
      style={{
        minHeight: height,
        borderWidth: 1.5,
        borderColor: "#C7C2B3",
        borderRadius: 12,
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 14,
        alignItems: align,
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );

  // --------- Render helpers ---------
  const renderText = () => (
    <>
      {LabelRow}
      <Box>
        <TextInput
          value={value ?? ""}
          onChangeText={setValue}
          placeholder="Escribe aquí…"
          style={{ fontSize: rem * 1.05, paddingVertical: 10 }}
        />
      </Box>
    </>
  );

  const renderNumber = () => (
    <>
      {LabelRow}
      <Box>
        <TextInput
          value={value?.toString() ?? ""}
          onChangeText={(t) => setValue(t.replace(/[^0-9.,-]/g, ""))}
          keyboardType="numeric"
          placeholder="0"
          style={{ fontSize: rem * 1.05, paddingVertical: 10 }}
        />
      </Box>
    </>
  );

  const renderBoolean = () => (
    <>
      {LabelRow}
      <View style={{ flexDirection: "row", borderWidth: 1.5, borderColor: "#C7C2B3", borderRadius: 12, overflow: "hidden" }}>
        <Pressable
          onPress={() => setValue(true)}
          style={{ flex: 1, paddingVertical: 14, alignItems: "center", backgroundColor: value === true ? "#E5F1E5" : "#FFFFFF" }}
        >
          <Body style={{ fontSize: rem * 1.05 }}>Sí</Body>
        </Pressable>
        <Pressable
          onPress={() => setValue(false)}
          style={{ flex: 1, paddingVertical: 14, alignItems: "center", borderLeftWidth: 1.5, borderLeftColor: "#C7C2B3", backgroundColor: value === false ? "#F5E8E8" : "#FFFFFF" }}
        >
          <Body style={{ fontSize: rem * 1.05 }}>No</Body>
        </Pressable>
      </View>
    </>
  );

  const renderList = (items: any[]) => (
    <>
      {LabelRow}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {items?.map((it, i) => (
          <Pressable
            key={i}
            onPress={() => setValue(it)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderWidth: 1.5,
              borderColor: value === it ? "#5B8B5B" : "#C7C2B3",
              borderRadius: 12,
              backgroundColor: value === it ? "#E5F1E5" : "#FFFFFF",
            }}
          >
            <Body>{String(it)}</Body>
          </Pressable>
        ))}
      </View>
    </>
  );

  const renderDataset = () => (
    <>
      {LabelRow}
      <Box height={64} align="center">
        <Body>
          Fuente externa (dataset)
          {"\n"}archivo: {campo.config?.file || "—"}
          {"\n"}columna: {campo.config?.column || "—"}
        </Body>
      </Box>
    </>
  );

  const renderDate = (mode: "date" | "hour") => (
    <>
      {LabelRow}
      <Box>
        <Body color="secondary">{mode === "date" ? "Seleccionar fecha (placeholder)" : "Seleccionar hora (placeholder)"}</Body>
      </Box>
    </>
  );

  const renderCalc = () => (
    <>
      {LabelRow}
      <Box>
        <Body color="secondary">Campo calculado: {campo.config?.operation || "—"}</Body>
      </Box>
    </>
  );

  const renderFirm = () => (
    <>
      {LabelRow}
      <Box height={140} align="center">
        <Body color="secondary">Área de firma (placeholder)</Body>
        <View style={{ height: gutter * 0.75 }} />
        <Button title="LIMPIAR" onPress={() => setValue(undefined)} />
      </Box>
    </>
  );

  // --------- Switch de tipos/clases ---------
  if (campo.tipo === "booleano") return renderBoolean();

  if (campo.tipo === "numerico") {
    if (campo.clase === "calc") return renderCalc();
    return renderNumber();
  }

  if (campo.tipo === "imagen" && campo.clase === "firm") return renderFirm();

  if (campo.tipo === "texto") {
    switch (campo.clase) {
      case "string":
      case "text":
        return renderText();
      case "list":
        return renderList(campo.config?.items || []);
      case "dataset":
        return renderDataset();
      case "date":
        return renderDate("date");
      case "hour":
        return renderDate("hour");
      default:
        return (
          <>
            {LabelRow}
            <Body color="secondary">(placeholder) tipo: {campo.tipo} / clase: {campo.clase}</Body>
          </>
        );
    }
  }

  // fallback genérico
  return (
    <>
      {LabelRow}
      <Body color="secondary">(placeholder) tipo: {campo.tipo} / clase: {campo.clase}</Body>
    </>
  );
}
