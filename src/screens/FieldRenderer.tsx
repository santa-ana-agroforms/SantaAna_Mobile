import React, { useCallback, useMemo, useRef } from "react";

import Boolean from "@/components/atoms/Boolean";
import DatasetSelect from "@/components/atoms/DatasetSelect";
import Input from "@/components/atoms/Input";
import Label from "@/components/atoms/Label";
import { Body } from "@/components/atoms/Typography";
import DateTimeField from "@/components/molecules/DateTimeField";
import FieldSignature from "@/components/molecules/FieldSignature";

import type { Campo } from "./FormPage";

// ⬇️ Redux
import CalcOutput from "@/components/atoms/CalcOutput";
import SignaturePreview from "@/components/atoms/SignaturePreview";
import DatasetField from "@/components/molecules/DatasetField";
import GroupEditor from "@/components/molecules/GroupEditor";
import {
  groupAddRow,
  groupRemoveRow,
  groupSetRowField,
  selectCurrentSession,
  selectCurrentSessionId,
  selectFieldValue,
  setFieldValue,
} from "@/forms/state/formSessionSlice";
import { AppDispatch } from "@/store";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import NumericInput from "@/components/molecules/NumberInput";

type Frame = { width: number; height: number };

type Props = {
  campo: Campo;
  formName?: string;
  referenceFrame: Frame;
  contentFrame: Frame;
  onChangeValue?: (name: string, value: unknown) => void;
  pageIndex?: number;
  external?: { value: any; onChange: (v: any) => void };
  mode?: "edit" | "review" | "view";
};

export const getFieldKind = (c: { tipo?: string; clase?: string }) => {
  const t = String(c?.tipo || "").toLowerCase();
  const k = String(c?.clase || "").toLowerCase();
  if (k === "group" || t === "grupo" || t === "group") return "group";
  if (t === "booleano" || t === "boolean" || k === "boolean") return "boolean";
  if (t === "numerico" || t === "numeric" || t === "number" || k === "number") return "number";
  if (t === "imagen" && k === "firm") return "firm";
  if (t === "dataset" || k === "dataset") return "dataset";
  if (t === "list" || k === "list") return "list";
  if (t === "date" || k === "date") return "date";
  if (t === "hour" || t === "time" || k === "hour" || k === "time") return "hour";
  if (k === "calc") return "calc";
  if (t === "texto" || t === "text" || k === "string" || k === "text") return "text";
  return "unknown";
};

// helper simple para leer id del config
const pickGroupIdFromConfig = (cfg: any): string | null => {
  if (!cfg) return null;
  return (
    (
      cfg.id_grupo ??
      cfg.id_group ??
      cfg.groupId ??
      cfg.group_id ??
      cfg.idGroup ??
      cfg.group?.id ??
      null
    )?.toString() ?? null
  );
};

const DEBUG_FR = false;

/** =========================
 *  🔎 DEBUG HELPERS
 *  ========================= */
const useDebugLogger = (label: string) => {
  const idRef = useRef(Math.random().toString(36).slice(2, 8));
  const renders = useRef(0);
  const startedAt = useRef(Date.now());

  const prefix = (suffix = "") => `FR:${label}#${idRef.current}${suffix ? ` ${suffix}` : ""}`;

  const log = (...args: any[]) => {
    if (!DEBUG_FR) return;
    console.log(prefix(), ...args);
  };

  const group = (title: string, fn: () => void) => {
    if (!DEBUG_FR) return fn();
    console.groupCollapsed(prefix(` ${title}`));
    try {
      fn();
    } finally {
      console.groupEnd();
    }
  };

  const onRender = (extra?: Record<string, unknown>) => {
    renders.current += 1;
    const since = ((Date.now() - startedAt.current) / 1000).toFixed(2) + "s";
    group("render", () => {
      log({ renders: renders.current, since, ...extra });
    });
  };

  return { log, group, onRender, id: idRef.current, renders };
};

export const bindGroupHandlers = ({
  dispatch,
  sessionId,
  pageIndex,
  idGrupo,
  nombreInternoGrupo,
}: {
  dispatch: AppDispatch;
  sessionId: string;
  pageIndex: number;
  idGrupo: string;
  nombreInternoGrupo: string;
}) => {
  return {
    addRow: () =>
      dispatch(
        groupAddRow({
          sessionId,
          nombreInternoGrupo,
          id_grupo: idGrupo,
          pageIndex,
        })
      ),
    removeRow: (rowIndex: number) =>
      dispatch(
        groupRemoveRow({
          sessionId,
          nombreInternoGrupo,
          rowIndex,
          pageIndex,
        })
      ),
    setRowField: (rowIndex: number, campoInterno: string, value: any) =>
      dispatch(
        groupSetRowField({
          sessionId,
          nombreInternoGrupo,
          rowIndex,
          campoInterno,
          value,
          pageIndex,
        })
      ),
  };
};

const FieldRenderer: React.FC<Props> = ({
  campo,
  referenceFrame,
  contentFrame,
  onChangeValue,
  pageIndex,
  external,
  mode,
}) => {
  // Prints campo info with good json formatting
  console.log("🎒🎒🎒🎒", JSON.stringify(campo, null, 2));
  const dispatch = useAppDispatch();
  // useAppSelector expects a selector with a different state signature; forward the store state as `any`
  const sessionId = useAppSelector((state: any) => selectCurrentSessionId(state));
  const currentSession = useAppSelector((state: any) => selectCurrentSession(state));
  const currentIndex = currentSession?.currentPageIndex ?? 0;
  const effectivePage = pageIndex ?? currentIndex;

  const label = campo.etiqueta || campo.nombre_interno;
  const help = campo.ayuda;

  const dbg = useDebugLogger(`${campo.nombre_interno}@p${effectivePage}`);

  // Valor: si hay 'external', úsalo; si no, Redux
  const valueFromRedux = useAppSelector((state: any) => {
    if (!sessionId) return undefined;
    const sel = selectFieldValue(sessionId, campo.nombre_interno, effectivePage);
    // console.warn("[FR] valueFromRedux selector", {
    //   sessionId,
    //   field: campo.nombre_interno,
    //   page: effectivePage,
    //   sel,
    // });
    // console.warn("[FR] valueFromRedux selector result:", sel(state));
    return sel(state);
  });
  const value = external ? external.value : valueFromRedux;

  // Commit → si hay external, usarlo; si no, dispatch al slice (+ evento opcional al padre)
  const onCommit = useCallback(
    (v: any) => {
      console.warn("[FR] onCommit", v);
      if (external) {
        external.onChange(v);
        onChangeValue?.(campo.nombre_interno, v);
        return;
      }
      if (!sessionId) {
        console.error("[FR] onCommit: no sessionId available");
        return;
      }
      // console.error("[FR] onCommit: dispatching to Redux");
      dispatch(
        setFieldValue({
          sessionId,
          nombreInterno: campo.nombre_interno,
          value: v,
          pageIndex: effectivePage,
        })
      );
      onChangeValue?.(campo.nombre_interno, v);
    },
    [dispatch, campo.nombre_interno, effectivePage, onChangeValue, sessionId, external]
  );
  // 🚨 LOG: cada render
  dbg.onRender({
    hasExternal: !!external,
    sessionId,
    currentIndex,
    effectivePage,
  });

  const LabelBlock = (
    <Label frame={referenceFrame} text={label} required={campo.requerido} help={help} />
  );

  // ---------- Renders simples ----------
  const renderText = () => (
    <Input
      frame={referenceFrame}
      label={label}
      required={campo.requerido}
      value={value ?? ""} // para visualizar; el commit mandará null si queda vacío
      onChangeText={(t) => onCommit(t)} // live-update (opcional)
      onCommitValue={(finalVal) => onCommit(finalVal)} // ← AQUÍ llega string | null
      placeholder={campo.ayuda ? campo.ayuda : "Escribe aquí…"}
    />
  );

  const renderNumber = () => (
    <NumericInput
      frame={referenceFrame}
      label={label}
      required={campo.requerido}
      placeholder={campo.ayuda ? campo.ayuda : "0"}
      value={value} // Pasas el valor tal cual viene de Redux
      onChange={(v) => onCommit(v)} // Pasas la función de guardado
    />
  );

  const renderBoolean = () => (
    <>
      {LabelBlock}
      <Boolean
        frame={referenceFrame}
        value={!!value}
        onChange={(v) => onCommit(v)}
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
        onChange={(v) => onCommit(v)}
        placeholder="Seleccionar…"
        allowDeselect
        showNoneOption
      />
    </>
  );

  const renderDataset = () => (
    <>
      {LabelBlock}
      <DatasetField
        campoId={campo.id_campo}
        value={value}
        onChange={(v) => onCommit(v)}
        frame={referenceFrame}
        placeholder="Seleccionar…"
      />
    </>
  );
  // ────────────────────────── Date / Hour ──────────────────────────
  const renderDate = (kind: "date" | "hour") => {
    const toUiDate = (raw: any): Date | null => {
      if (!raw) return null;
      if (raw instanceof Date) return raw;
      const s = String(raw).trim();

      if (kind === "hour" && s.includes(":")) {
        const [h, m] = s.split(":").map(Number);
        return new Date(2000, 0, 1, h, m);
      }

      if (kind === "date" && s.includes("-")) {
        const [y, m, d] = s.split("-").map(Number);
        return new Date(y, m - 1, d);
      }

      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d;
    };

    const toStoreStr = (d: Date): string => {
      if (kind === "hour") {
        return d.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit", hour12: false });
      }
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    return (
      <DateTimeField
        mode={kind === "date" ? "date" : "time"}
        value={toUiDate(value)}
        onChange={(d) => onCommit(d ? toStoreStr(d) : null)}
        label={label}
        required={campo.requerido}
        placeholder={kind === "date" ? "Seleccionar fecha" : "Seleccionar hora"}
        frame={referenceFrame}
      />
    );
  };

  const renderCalc = () => {
    if (!sessionId) return null;
    return (
      <CalcOutput
        frame={referenceFrame}
        label={label}
        help={help}
        required={campo.requerido}
        operation={campo?.config?.operation}
        vars={Array.isArray(campo?.config?.vars) ? campo.config.vars : []}
        fieldName={campo.nombre_interno} // se guarda con el nombre del campo actual
        sessionId={sessionId}
        pageIndex={effectivePage}
        placeholderText="(calculado)"
        // format={(v) => String(v)} // opcional
      />
    );
  };

  const renderFirm = () => {
    if (mode === "view" && typeof value === "string") {
      return (
        <>
          {LabelBlock}
          <SignaturePreview value={value} height={referenceFrame.width * 0.5} />
        </>
      );
    }

    // … si NO es readOnly, mantener tu FieldSignature para firmar/editar …
    let t: any = null;
    let lastRef: any = null;

    const throttledCommit = (next: any) => {
      if (typeof next === "string") {
        onCommit(next);
        return;
      }
      if (typeof next === "string" && next === lastRef) return;
      if (Array.isArray(next) && Array.isArray(lastRef) && next.length === lastRef.length) return;
      if (t) return;
      t = setTimeout(() => {
        t = null;
      }, 150);
      lastRef = next;
      onCommit(next);
    };

    return (
      <>
        {LabelBlock}
        <FieldSignature
          referenceFrame={referenceFrame}
          contentFrame={contentFrame}
          onChange={(payload: any) => {
            const next = payload?.image ?? payload?.strokes;
            throttledCommit(next);
          }}
        />
      </>
    );
  };
  // ---------- Grupo ----------
  // ---------- Branch de grupo (MUY simple)
  const groupId = useMemo(() => pickGroupIdFromConfig(campo?.config), [campo?.config]);

  const renderGroup = () => {
    const entries = Array.isArray(value) ? (value as any[]) : [];
    const title = campo.etiqueta?.trim() || campo.nombre_interno;
    const subtitle = campo.ayuda || "";

    const isControlled = !!external;

    const reduxProps =
      !isControlled && sessionId
        ? {
            sessionId,
            pageIndex: effectivePage,
            idGrupo: groupId!,
            nombreInternoGrupo: campo.nombre_interno,
          }
        : undefined;

    const handlers = reduxProps
      ? bindGroupHandlers({
          dispatch,
          sessionId: reduxProps.sessionId,
          pageIndex: reduxProps.pageIndex,
          idGrupo: reduxProps.idGrupo,
          nombreInternoGrupo: reduxProps.nombreInternoGrupo,
        })
      : null;

    return (
      <GroupEditor
        groupId={groupId!}
        title={title}
        subtitle={subtitle}
        entries={entries}
        referenceFrame={referenceFrame}
        contentFrame={contentFrame}
        pageIndex={effectivePage}
        reduxProps={reduxProps}
        bindReduxHandlers={
          handlers
            ? (set) =>
                set({
                  addRow: handlers.addRow,
                  removeRow: handlers.removeRow,
                  setRowField: handlers.setRowField,
                })
            : undefined
        }
        onChange={
          isControlled
            ? (nextRows) => {
                external!.onChange(nextRows);
                onChangeValue?.(campo.nombre_interno, nextRows);
              }
            : undefined
        }
        minEntries={0}
      />
    );
  };

  // ——— En tu switch final:
  const kind = getFieldKind(campo);

  if (kind === "group") return renderGroup();
  if (kind === "boolean") return renderBoolean();
  if (kind === "number") return renderNumber();
  if (kind === "firm") return renderFirm();

  if (kind === "dataset") return renderDataset(); // 👈 ahora sí soporta tipo: "dataset"
  if (kind === "list") return renderList();

  if (kind === "date") return renderDate("date");
  if (kind === "hour") return renderDate("hour");
  if (kind === "calc") return renderCalc();

  if (kind === "text") return renderText();

  // Fallback
  return (
    <>
      {LabelBlock}
      <Body frame={referenceFrame} color="secondary" size="sm">
        (placeholder) tipo: {String(campo.tipo)} / clase: {String(campo.clase)}
      </Body>
    </>
  );
};

export default FieldRenderer;
