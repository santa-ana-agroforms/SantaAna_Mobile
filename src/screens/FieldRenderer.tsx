// src/components/forms/FieldRenderer.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import Boolean from "@/components/atoms/Boolean";
import DatasetSelect from "@/components/atoms/DatasetSelect";
import Input from "@/components/atoms/Input";
import Label from "@/components/atoms/Label";
import { Body } from "@/components/atoms/Typography";
import DateTimeField from "@/components/molecules/DateTimeField";
import FieldSignature from "@/components/molecules/FieldSignature";
import { colors } from "@/theme/tokens";

import { getGroupOrFetch } from "@/api/groups"; // asegúrate que este path coincida con tu proyecto
import type { Campo } from "./FormPage";

type Frame = { width: number; height: number };

// (Opcional) Tipo mínimo del grupo para no importar el de la API
type GroupTreeLite = {
  id_grupo?: string;
  id_group?: string;
  nombre?: string;
  name?: string;
  fields?: Campo[];
  campos?: Campo[];
};

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

/** Detecta el ID de grupo en config (contempla distintas variantes). */
const pickGroupIdFromConfig = (cfg: any): string | null => {
  if (!cfg) return null;
  const cand =
    cfg.id_group ??
    cfg.id_grupo ??
    cfg.groupId ??
    cfg.group_id ??
    cfg.idGroup ??
    cfg.group?.id ??
    null;
  return cand != null ? String(cand) : null;
};

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

  // ==== Dimensiones derivadas de referenceFrame ====
  const dims = useMemo(() => {
    const minSide = Math.min(referenceFrame.width, referenceFrame.height);

    const baseRem = clamp(minSide * 0.042, 14, 18);

    const labelBottom = clamp(minSide * 0.008, 6, 12);
    const helpTop = clamp(minSide * 0.004, 4, 8);
    const fieldGap = clamp(minSide * 0.016, 10, 22);

    const inputMinH = clamp(minSide * 0.06, 44, 62);
    const inputPadH = clamp(minSide * 0.014, 12, 18);
    const inputPadV = clamp(minSide * 0.01, 8, 14);
    const inputRadius = clamp(minSide * 0.018, 8, 12);

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
      segPadV,
      chipGap,
      chipPadH,
      chipPadV,
      chipRadius,
      firmH,
      minSide,
    };
  }, [referenceFrame]);

  // ==== Label block ====
  const LabelBlock = (
    <Label frame={referenceFrame} text={label} required={campo.requerido} help={help} />
  );

  // ==== Box contenedor (bordes, padding) ====
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

  // ==== Renders atómicos/moleculares ====
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
        yesLabel="Sí"
        noLabel="No"
        showAccentBars
      />
    </>
  );

  const renderList = (items: any[]) => (
    <>
      <Label frame={referenceFrame} text={label} required={campo.requerido} help={help} />
      <DatasetSelect
        frame={referenceFrame}
        items={items} // estáticos
        value={value}
        onChange={(v) => setAndEmit(v)} // v: string | number | boolean | undefined
        placeholder="Selecciona una opción…"
        allowDeselect
        showNoneOption
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
        placeholder="Selecciona un valor…"
        // Puedes pasar items desde config si vienen precargados:
        // items={campo.config?.items}
        showNoneOption={false}
      />
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

  const renderFirm = () => (
    <>
      {LabelBlock}
      <FieldSignature
        referenceFrame={referenceFrame}
        contentFrame={contentFrame}
        onChange={(payload: any) => {
          // payload: { strokes: any[]; image?: string }
          setAndEmit(payload.image ?? payload.strokes);
        }}
      />
    </>
  );

  // ==== Grupo: detectar, cargar y renderizar subcampos ====
  const groupId = useMemo(() => pickGroupIdFromConfig(campo?.config), [campo?.config]);
  const isGroup = !!groupId;

  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupData, setGroupData] = useState<GroupTreeLite | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!isGroup || !groupId) {
      setGroupLoading(false);
      setGroupError(null);
      setGroupData(null);
      return;
    }

    setGroupLoading(true);
    setGroupError(null);
    setGroupData(null);

    (async () => {
      try {
        const g = await getGroupOrFetch(groupId);
        if (cancelled) return;
        setGroupData(g as GroupTreeLite);
      } catch (e: any) {
        if (cancelled) return;
        setGroupError(e?.message ?? "No se pudo cargar el grupo.");
      } finally {
        if (!cancelled) setGroupLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isGroup, groupId]);

  const renderGroup = () => {
    // UI de grupo
    return (
      <View style={{ gap: dims.fieldGap * 0.9 }}>
        {/* título/etiqueta del "campo grupo" */}
        {
          <Label
            frame={referenceFrame}
            text={label}
            required={campo.requerido}
            help={help}
            isGroup
            dividerThickness={dims.minSide * 0.005}
          />
        }

        {/* estado de carga / error */}
        {groupLoading ? (
          <Body frame={referenceFrame} color="secondary" size="sm">
            Cargando grupo…
          </Body>
        ) : groupError ? (
          <Body frame={referenceFrame} size="sm" style={{ color: colors.danger600 }}>
            {groupError}
          </Body>
        ) : null}

        {/* subcampos */}
        {groupData ? (
          <View style={{ gap: dims.fieldGap }}>
            {(groupData.fields || groupData.campos || [])
              .slice()
              .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
              .map((sub) => (
                <View key={sub.id_campo} style={{}}>
                  <FieldRenderer
                    campo={sub}
                    formName={/* formName */ undefined}
                    referenceFrame={referenceFrame}
                    contentFrame={contentFrame}
                    onChangeValue={onChangeValue}
                  />
                </View>
              ))}
          </View>
        ) : null}
        {/* Lineaa de cierre */}
        <View
          style={{
            marginTop: dims.minSide * 0.01,
            alignSelf: "stretch",
            height: dims.minSide * 0.005,
            backgroundColor: colors.textTertiary,
            opacity: 0.9,
          }}
        />
      </View>
    );
  };

  // ==== Switch principal por tipo/clase (incluye grupo) ====
  if (isGroup) return renderGroup();

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
