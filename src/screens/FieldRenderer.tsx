// src/components/forms/FieldRenderer.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { FormSession } from "@/forms/runtime/FormSession";
import type { Campo } from "./FormPage";

type Frame = { width: number; height: number };
type GroupTreeLite = { fields?: Campo[]; campos?: Campo[]; nombre?: string; name?: string };

type Props = {
  campo: Campo;
  formName?: string;
  referenceFrame: Frame;
  contentFrame: Frame;
  onChangeValue?: (name: string, value: unknown) => void;
  formSession: FormSession; // sesión del formulario
  /** Índice de la página; si no se pasa, se usa la actual de la sesión */
  pageIndex?: number;
  /** Tick externo del padre para re-lectura desde la sesión tras un write */
  sessionVer?: number;
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

const FieldRenderer: React.FC<Props> = ({
  campo,
  referenceFrame,
  contentFrame,
  onChangeValue,
  formSession,
  pageIndex,
  sessionVer = 0,
}) => {
  const label = campo.etiqueta || campo.nombre_interno;
  const help = campo.ayuda;

  const currentIndex = pageIndex ?? formSession.getCurrentPageIndex();

  // Valor SIEMPRE desde la sesión; re-lee cuando cambie sessionVer
  const value = useMemo(
    () => formSession.getFieldValue(campo.nombre_interno, currentIndex),
    [formSession, campo.nombre_interno, currentIndex, sessionVer]
  );

  // Emitir hacia el padre (el padre hace setFieldValue + bump del tick)
  const onCommit = useCallback(
    (v: any) => onChangeValue?.(campo.nombre_interno, v),
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

  // ---------- Renders simples ----------
  const renderText = () => (
    <Input
      frame={referenceFrame}
      label={label}
      required={campo.requerido}
      value={value ?? ""}
      onChangeText={onCommit}
      placeholder={campo.ayuda ? campo.ayuda : "Escribe aquí…"}
    />
  );

  const renderNumber = () => (
    <Input
      frame={referenceFrame}
      label={label}
      required={campo.requerido}
      value={value?.toString?.() ?? ""}
      keyboardType="numeric"
      onChangeText={(t) => onCommit(t.replace(/[^0-9.,-]/g, ""))}
      placeholder={campo.ayuda ? campo.ayuda : "0"}
    />
  );

  const renderBoolean = () => (
    <>
      {LabelBlock}
      <Boolean
        frame={referenceFrame}
        value={!!value}
        onChange={onCommit}
        yesLabel="Sí"
        noLabel="No"
        showAccentBars
      />
    </>
  );

  const listItems = useMemo(() => campo.config?.items || [], [campo.config?.items]);

  const renderList = () => (
    <>
      <Label frame={referenceFrame} text={label} required={campo.requerido} help={help} />
      <DatasetSelect
        frame={referenceFrame}
        items={listItems}
        value={value}
        onChange={onCommit}
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
        onChange={onCommit}
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
      onChange={onCommit}
      label={label}
      required={campo.requerido}
      placeholder={mode === "date" ? "Seleccionar fecha" : "Seleccionar hora"}
      frame={referenceFrame}
    />
  );

  const renderCalc = () => {
    const calcValue = value; // recalculado por FormSession.setFieldValue()
    return (
      <>
        {LabelBlock}
        <Box>
          <Body frame={referenceFrame} color="secondary" size="sm">
            {calcValue ?? `(calculado) ${campo.config?.operation ?? "—"}`}
          </Body>
        </Box>
      </>
    );
  };

  const renderFirm = () => (
    <>
      {LabelBlock}
      <FieldSignature
        referenceFrame={referenceFrame}
        contentFrame={contentFrame}
        onChange={(payload: any) => onCommit(payload.image ?? payload.strokes)}
      />
    </>
  );

  // ---------- Grupo ----------
  const groupId = useMemo(() => pickGroupIdFromConfig(campo?.config), [campo?.config]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupData, setGroupData] = useState<GroupTreeLite | null>(null);

  // Guard para evitar bucles: solo actúa si CAMBIÓ el groupId
  const lastGroupIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Si no hay cambio real, no hagas nada (evita setState en cada render)
    if (lastGroupIdRef.current === groupId) return;
    lastGroupIdRef.current = groupId;

    let cancelled = false;

    if (!groupId) {
      // Solo resetea si realmente cambió a null
      setGroupLoading(false);
      setGroupError(null);
      setGroupData(null);
      return;
    }

    setGroupLoading(true);
    setGroupError(null);
    // no limpies groupData aquí para evitar parpadeos

    (async () => {
      try {
        const g = await getGroupOrFetch(groupId);
        if (!cancelled) {
          setGroupData((prev) => (prev === g ? prev : (g as GroupTreeLite)));
        }
      } catch (e: any) {
        if (!cancelled) setGroupError(e?.message ?? "No se pudo cargar el grupo.");
      } finally {
        if (!cancelled) setGroupLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const groupFields = useMemo(
    () => (groupData ? groupData.fields || groupData.campos || [] : []),
    [groupData]
  );

  const entries: GroupEntry[] = useMemo(
    () => (Array.isArray(value) ? (value as GroupEntry[]) : []),
    [value]
  );

  const renderGroup = () => {
    return (
      <View style={{ gap: 0 }}>
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
            onChange={(next) => onCommit(next)} // persistir array completo en sesión
            referenceFrame={referenceFrame}
            contentFrame={contentFrame}
          >
            {({ campo: subCampo, onChange }) => (
              <FieldRenderer
                campo={subCampo}
                referenceFrame={referenceFrame}
                contentFrame={contentFrame}
                // subcampos viven “local” al grupo y se consolidan con onChange(next)
                onChangeValue={(_n, v) => onChange(v)}
                formSession={formSession}
                pageIndex={currentIndex}
                sessionVer={sessionVer}
              />
            )}
          </RepeatableGroup>
        ) : null}
      </View>
    );
  };

  // ---------- Switch principal ----------
  const isGroup = !!groupId;
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
        return renderList();
      case "dataset":
        return renderDataset();
      case "date":
        return renderDate("date");
      case "hour":
        return renderDate("hour");
    }
  }

  // Fallback
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
