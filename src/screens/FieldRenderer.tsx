// src/components/forms/FieldRenderer.tsx
import Boolean from "@/components/atoms/Boolean";
import DatasetSelect from "@/components/atoms/DatasetSelect";
import Input from "@/components/atoms/Input";
import Label from "@/components/atoms/Label";
import { Body } from "@/components/atoms/Typography";
import DateTimeField from "@/components/molecules/DateTimeField";

import FieldSignature from "@/components/molecules/FieldSignature";
import { colors } from "@/theme/tokens";
import React, { useMemo, useState } from "react";
import { View } from "react-native";
import type { Campo } from "./FormPage";

type Frame = { width: number; height: number };

type Props = {
  campo: Campo;
  formName?: string;
  /** Escala tipográfica/geométrica (lado menor) */
  referenceFrame: Frame;
  /** Ancho/alto útil dentro del body */
  contentFrame: Frame;
  /** (Opcional) callback para subir estado al store */
  onChangeValue?: (name: string, value: unknown) => void;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const FieldRenderer: React.FC<Props> = ({
  campo,
  // formName,
  referenceFrame,
  contentFrame,
  onChangeValue,
}) => {
  const label = campo.etiqueta || campo.nombre_interno;
  const help = campo.ayuda;

  // Estado local demo. En producción, elevar a un form store y usar onChangeValue.
  const [value, setValue] = useState<any>(undefined);
  const setAndEmit = (v: any) => {
    setValue(v);
    onChangeValue?.(campo.nombre_interno, v);
  };

  const dims = useMemo(() => {
    const minSide = Math.min(referenceFrame.width, referenceFrame.height);

    // Base tipográfica derivada (≈16 en teléfonos medianos)
    const baseRem = clamp(minSide * 0.042, 14, 18);

    // Espaciados y medidas
    const labelBottom = clamp(minSide * 0.008, 6, 12);
    const helpTop = clamp(minSide * 0.004, 4, 8);
    const fieldGap = clamp(minSide * 0.016, 10, 22);

    const inputMinH = clamp(minSide * 0.06, 44, 62);
    const inputPadH = clamp(minSide * 0.014, 12, 18);
    const inputPadV = clamp(minSide * 0.01, 8, 14);
    const inputRadius = clamp(minSide * 0.018, 8, 12);
    const inputFont = clamp(baseRem * 1.05, 14, 20);

    const segPadV = clamp(minSide * 0.012, 10, 16);

    const chipGap = clamp(minSide * 0.01, 8, 14);
    const chipPadH = clamp(minSide * 0.014, 12, 18);
    const chipPadV = clamp(minSide * 0.01, 8, 14);
    const chipRadius = clamp(minSide * 0.018, 8, 12);

    const firmH = clamp(minSide * 0.22, 120, 180);

    return {
      baseRem,
      labelBottom,
      helpTop,
      fieldGap,
      inputMinH,
      inputPadH,
      inputPadV,
      inputRadius,
      inputFont,
      segPadV,
      chipGap,
      chipPadH,
      chipPadV,
      chipRadius,
      firmH,
      minSide,
    };
  }, [referenceFrame]);

  const LabelBlock = (
    <Label frame={referenceFrame} text={label} required={campo.requerido} help={help} />
  );

  const Box: React.FC<React.PropsWithChildren<{ minH?: number; center?: boolean }>> = ({
    children,
    minH = dims.inputMinH,
    center = true,
  }) => (
    <View
      style={{
        minHeight: minH,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: dims.inputRadius,
        backgroundColor: colors.neutral0,
        paddingHorizontal: dims.inputPadH,
        paddingVertical: dims.inputPadV,
        alignItems: center ? "center" : undefined,
        justifyContent: center ? "center" : undefined,
      }}
    >
      {children}
    </View>
  );

  const renderText = () => (
    <Input
      frame={referenceFrame}
      label={label}
      required={campo.requerido}
      value={value ?? ""}
      onChangeText={setAndEmit}
      placeholder={campo.ayuda ? campo.ayuda : "Escribe aquí…"}
    />
  );

  // Numérico
  const renderNumber = () => (
    <Input
      frame={referenceFrame}
      label={label}
      required={campo.requerido}
      value={value?.toString() ?? ""}
      keyboardType="numeric"
      onChangeText={(t) => setAndEmit(t.replace(/[^0-9.,-]/g, ""))}
      placeholder={campo.ayuda ? campo.ayuda : "0"}
    />
  );

  const renderBoolean = () => (
    <>
      {LabelBlock}
      <Boolean
        frame={referenceFrame}
        value={value}
        onChange={(v) => setAndEmit(v)}
        // opcionales:
        yesLabel="Sí"
        noLabel="No"
        // error={!!algunaValidacion}
        showAccentBars
      />
    </>
  );

  // dentro de FieldRenderer.tsx

  // ⬇️ Sustituye el renderList anterior por este:
  const renderList = (items: any[]) => (
    <>
      <Label frame={referenceFrame} text={label} required={campo.requerido} help={help} />
      <DatasetSelect
        frame={referenceFrame}
        items={items} // <- estáticos, no CSV
        value={value}
        onChange={(v) => setAndEmit(v)} // v: string | undefined
        placeholder="Selecciona una opción…"
        allowDeselect // tocar la opción activa limpia
        showNoneOption // agrega “Ninguno” al inicio
      />
    </>
  );

  const renderDataset = () => (
    <>
      {LabelBlock}
      <DatasetSelect
        frame={referenceFrame}
        value={value}
        onChange={(v) => setAndEmit(v)}
        // Opcional: si quieres pasar opciones estáticas desde config:
        // items={campo.config?.items}
        placeholder="Selecciona un valor…"
        showNoneOption={false}
      />
      {/* Info de la “fuente” (mock) */}
      <Body frame={referenceFrame} color="secondary" size="xs" style={{ marginTop: 6 }}>
        Fuente externa (CSV)
        {"\n"}archivo: {campo.config?.file || "—"}
        {"\n"}columna: {campo.config?.column || "—"}
      </Body>
    </>
  );

  const renderDate = (mode: "date" | "hour") => (
    <DateTimeField
      mode={mode === "date" ? "date" : "time"}
      value={value ?? null}
      onChange={(d) => setAndEmit(d)}
      label={label}
      required={campo.requerido}
      placeholder={mode === "date" ? "Seleccionar fecha" : "Seleccionar hora"}
      frame={referenceFrame}
    />
  );

  const renderCalc = () => (
    <>
      {LabelBlock}
      <Box>
        <Body frame={referenceFrame} color="secondary" size="sm">
          Campo calculado: {campo.config?.operation || "—"}
        </Body>
      </Box>
    </>
  );

  // dentro de FieldRenderer
  const renderFirm = () => (
    <>
      {LabelBlock}
      <FieldSignature
        referenceFrame={referenceFrame}
        contentFrame={contentFrame}
        onChange={(payload: any) => {
          // payload: { strokes: any[]; image?: string }
          // guarda la imagen (uri) si existe; si no, guarda los strokes
          setAndEmit(payload.image ?? payload.strokes);
        }}
      />
    </>
  );

  // ---------- Switch por tipo/clase ----------
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
            {LabelBlock}
            <Body frame={referenceFrame} color="secondary" size="sm">
              (placeholder) tipo: {campo.tipo} / clase: {campo.clase}
            </Body>
          </>
        );
    }
  }

  // Fallback genérico
  return (
    <>
      {LabelBlock}
      <Body frame={referenceFrame} color="secondary" size="sm">
        (placeholder) tipo: {campo.tipo} / clase: {campo.clase}
      </Body>
    </>
  );
};

export default FieldRenderer;
