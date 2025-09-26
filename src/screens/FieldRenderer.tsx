// src/components/forms/FieldRenderer.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import Boolean from "@/components/atoms/Boolean";
import DatasetSelect from "@/components/atoms/DatasetSelect";
import Input from "@/components/atoms/Input";
import Label from "@/components/atoms/Label";
import { Body } from "@/components/atoms/Typography";
import DateTimeField from "@/components/molecules/DateTimeField";
import FieldSignature from "@/components/molecules/FieldSignature";
import RepeatableGroup, { type GroupEntry } from "@/components/molecules/RepeatableGroup";
import { colors } from "@/theme/tokens";

import { getGroupOrFetch } from "@/api/groups";
import type { Campo } from "./FormPage";

type Frame = { width: number; height: number };
type GroupTreeLite = { fields?: Campo[]; campos?: Campo[]; nombre?: string; name?: string };

type Props = {
  campo: Campo;
  formName?: string;
  referenceFrame: Frame;
  contentFrame: Frame;
  onChangeValue?: (name: string, value: unknown) => void;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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

const shallowEqualEntries = (a?: GroupEntry[] | any, b?: GroupEntry[] | any) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ea = a[i],
      eb = b[i];
    if (ea.id !== eb.id) return false;
    const ka = Object.keys(ea.values);
    const kb = Object.keys(eb.values);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!Object.is(ea.values[k], eb.values[k])) return false;
  }
  return true;
};

const FieldRenderer: React.FC<Props> = ({ campo, referenceFrame, contentFrame, onChangeValue }) => {
  const label = campo.etiqueta || campo.nombre_interno;
  const help = campo.ayuda;

  const [value, setValue] = useState<any>(undefined);

  const setAndEmit = useCallback(
    (v: any) => {
      setValue((prev: any) => {
        const same =
          Array.isArray(prev) && Array.isArray(v)
            ? shallowEqualEntries(prev, v)
            : Object.is(prev, v);

        if (!same) {
          onChangeValue?.(campo.nombre_interno, v);
          return v;
        }
        return prev;
      });
    },
    [onChangeValue, campo.nombre_interno]
  );

  const dims = useMemo(() => {
    const minSide = Math.min(referenceFrame.width, referenceFrame.height);
    return {
      inputMinH: clamp(minSide * 0.06, 44, 62),
      inputPadH: clamp(minSide * 0.014, 12, 18),
      inputPadV: clamp(minSide * 0.01, 8, 14),
      inputRadius: clamp(minSide * 0.018, 8, 12),
      fieldGap: clamp(minSide * 0.016, 10, 22),
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

  // --- renders simples ---
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
        onChange={setAndEmit}
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
        items={items}
        value={value}
        onChange={setAndEmit}
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
        onChange={setAndEmit}
        placeholder="Selecciona un valor…"
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
      onChange={setAndEmit}
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
        onChange={(payload: any) => setAndEmit(payload.image ?? payload.strokes)}
      />
    </>
  );

  // --- grupo ---
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
        if (!cancelled) setGroupData(g as GroupTreeLite);
      } catch (e: any) {
        if (!cancelled) setGroupError(e?.message ?? "No se pudo cargar el grupo.");
      } finally {
        if (!cancelled) setGroupLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isGroup, groupId]);

  const groupFields = useMemo(
    () => (groupData ? groupData.fields || groupData.campos || [] : []),
    [groupData]
  );

  const renderGroup = () => {
    const entries: GroupEntry[] = Array.isArray(value) ? value : [];

    return (
      <View style={{ gap: clamp(dims.minSide * 0.9, 0, 0) /* solo para mantener estructura */ }}>
        <Label
          frame={referenceFrame}
          text={label}
          required={campo.requerido}
          help={help}
          isGroup
          dividerThickness={dims.minSide * 0.005}
        />

        {groupLoading ? (
          <Body frame={referenceFrame} color="secondary" size="sm">
            Cargando grupo…
          </Body>
        ) : groupError ? (
          <Body frame={referenceFrame} size="sm" style={{ color: colors.danger600 }}>
            {groupError}
          </Body>
        ) : null}

        {groupFields.length ? (
          <RepeatableGroup
            fieldsTemplate={groupFields}
            entries={entries}
            onChange={(next) => setAndEmit(next)}
            referenceFrame={referenceFrame}
            contentFrame={contentFrame}
          >
            {({ campo: subCampo, onChange }) => (
              <FieldRenderer
                campo={subCampo}
                referenceFrame={referenceFrame}
                contentFrame={contentFrame}
                onChangeValue={(_n, v) => onChange(v)}
              />
            )}
          </RepeatableGroup>
        ) : null}
      </View>
    );
  };

  // --- switch principal ---
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
    }
  }

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
