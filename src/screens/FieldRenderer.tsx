import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import Boolean from "@/components/atoms/Boolean";
import DatasetSelect from "@/components/atoms/DatasetSelect";
import Input from "@/components/atoms/Input";
import Label from "@/components/atoms/Label";
import { Body } from "@/components/atoms/Typography";
import DateTimeField from "@/components/molecules/DateTimeField";
import FieldSignature from "@/components/molecules/FieldSignature";
import RepeatableGroup, { type GroupRow } from "@/components/molecules/RepeatableGroup";
import { colors } from "@/theme/tokens";

import { getGroupOrFetch } from "@/api/groups";
import type { Campo } from "./FormPage";

// ⬇️ Redux
import {
  selectCurrentSession,
  selectCurrentSessionId,
  selectFieldValue,
  setFieldValue,
} from "@/forms/state/formSessionSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

type Frame = { width: number; height: number };
type GroupTreeLite = { fields?: Campo[]; campos?: Campo[]; nombre?: string; name?: string };

type Props = {
  campo: Campo;
  formName?: string;
  referenceFrame: Frame;
  contentFrame: Frame;
  onChangeValue?: (name: string, value: unknown) => void; // para integraciones custom
  pageIndex?: number;
  /** Si se usa dentro de un grupo, se inyecta el valor/commit externos y NO se toca Redux */
  external?: { value: any; onChange: (v: any) => void };
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

/** =========================
 *  🔎 DEBUG HELPERS
 *  ========================= */
const DEBUG = false;
const useDebugLogger = (label: string) => {
  const idRef = useRef(Math.random().toString(36).slice(2, 8));
  const renders = useRef(0);
  const startedAt = useRef(Date.now());

  const prefix = (suffix = "") => `FR:${label}#${idRef.current}${suffix ? ` ${suffix}` : ""}`;

  const log = (...args: any[]) => {
    if (!DEBUG) return;
    // @ts-ignore
    console.log(prefix(), ...args);
  };

  const group = (title: string, fn: () => void) => {
    if (!DEBUG) return fn();
    // @ts-ignore
    console.groupCollapsed(prefix(` ${title}`));
    try {
      fn();
    } finally {
      // @ts-ignore
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

const FieldRenderer: React.FC<Props> = ({
  campo,
  referenceFrame,
  contentFrame,
  onChangeValue,
  pageIndex,
  external,
}) => {
  const dispatch = useAppDispatch();
  const sessionId = useAppSelector(selectCurrentSessionId);
  const currentSession = useAppSelector(selectCurrentSession);
  const currentIndex = currentSession?.currentPageIndex ?? 0;
  const effectivePage = pageIndex ?? currentIndex;

  const label = campo.etiqueta || campo.nombre_interno;
  const help = campo.ayuda;

  const dbg = useDebugLogger(`${campo.nombre_interno}@p${effectivePage}`);

  // Valor: si hay 'external', úsalo; si no, Redux
  const valueSelector = sessionId
    ? selectFieldValue(sessionId, campo.nombre_interno, effectivePage)
    : () => undefined as any;
  const valueFromRedux = useAppSelector(valueSelector);
  const value = external ? external.value : valueFromRedux;

  React.useEffect(() => {
    console.log("[FR] valueFromRedux changed", {
      field: campo.nombre_interno,
      page: effectivePage,
      newValue: value,
      newType: value == null ? value : value.constructor?.name,
    });
  }, [value, campo.nombre_interno, effectivePage]);
  // Commit → si hay external, usarlo; si no, dispatch al slice (+ evento opcional al padre)
  const onCommit = useCallback(
    (v: any) => {
      if (external) {
        external.onChange(v);
        onChangeValue?.(campo.nombre_interno, v);
        return;
      }
      if (!sessionId) return;
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
      onChangeText={(t) => onCommit(t)}
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
      onChangeText={(t) => {
        const sanitized = t.replace(/[^0-9.,-]/g, "");
        onCommit(sanitized);
      }}
      placeholder={campo.ayuda ? campo.ayuda : "0"}
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
        onChange={(v) => onCommit(v)}
        placeholder="Selecciona un valor…"
      />
      <Body frame={referenceFrame} color="secondary" size="xs" style={{ marginTop: 6 }}>
        Fuente externa (CSV)
        {"\n"}archivo: {campo.config?.file || "—"}
        {"\n"}columna: {campo.config?.column || "—"}
      </Body>
    </>
  );

  // dentro de FieldRenderer

  const renderDate = (kind: "date" | "hour") => {
    const toUiDate = (s?: string | null): Date | null => {
      if (!s) return null;
      if (kind === "date") {
        const [y, m, d] = s.split("-").map(Number);
        return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
      } else {
        const [H, M] = s.split(":").map(Number);
        return new Date(2000, 0, 1, H ?? 0, M ?? 0, 0, 0); // ancla estable
      }
    };

    const toStoreStr = (d: Date | null): string | null => {
      if (!d) return null;
      if (kind === "date") {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      } else {
        const H = String(d.getHours()).padStart(2, "0");
        const M = String(d.getMinutes()).padStart(2, "0");
        return `${H}:${M}`;
      }
    };

    // Log de lo que llega desde Redux/external
    console.log("[FR] renderDate:input", {
      field: campo.nombre_interno,
      kind,
      rawValue: value,
      rawType: value == null ? value : value.constructor?.name,
    });

    const uiValue: Date | null =
      value instanceof Date ? value : typeof value === "string" ? toUiDate(value) : null;

    if (uiValue) {
      console.log("[FR] renderDate:uiValue", {
        field: campo.nombre_interno,
        kind,
        uiLocal: uiValue.toString(),
        uiISO: uiValue.toISOString(),
      });
    } else {
      console.log("[FR] renderDate:uiValue NULL", { field: campo.nombre_interno, kind });
    }

    return (
      <DateTimeField
        mode={kind === "date" ? "date" : "time"}
        value={uiValue}
        onChange={(d) => {
          const out = toStoreStr(d);
          console.log("[FR] renderDate:onChange -> onCommit", {
            field: campo.nombre_interno,
            kind,
            receivedLocal: d?.toString?.(),
            receivedISO: d?.toISOString?.(),
            toStore: out,
          });
          onCommit(out);
        }}
        label={label}
        required={campo.requerido}
        placeholder={kind === "date" ? "Seleccionar fecha" : "Seleccionar hora"}
        frame={referenceFrame}
      />
    );
  };

  const renderCalc = () => {
    const calcValue = value; // el slice recalcula con recomputeAllCalcs
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

  const renderFirm = () => {
    // Throttle simple
    let t: any = null;
    let lastRef: any = null;

    const throttledCommit = (next: any) => {
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
  const groupId = useMemo(() => pickGroupIdFromConfig(campo?.config), [campo?.config]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupData, setGroupData] = useState<GroupTreeLite | null>(null);
  const lastGroupIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastGroupIdRef.current === groupId) return;
    lastGroupIdRef.current = groupId;

    let cancelled = false;
    if (!groupId) {
      setGroupLoading(false);
      setGroupError(null);
      setGroupData(null);
      return;
    }

    setGroupLoading(true);
    setGroupError(null);

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
  }, [groupId]);

  const groupFields = useMemo(
    () => (groupData ? groupData.fields || groupData.campos || [] : []),
    [groupData]
  );

  // Valor de grupo (array de filas planas). Aseguramos __id en UI.
  const groupRows: GroupRow[] = useMemo(() => {
    const raw = Array.isArray(value) ? (value as any[]) : [];
    return raw.map((r, i) => ({
      ...r,
      __id: r?.__id ?? `${campo.nombre_interno}_${i}_${Math.random().toString(36).slice(2, 8)}`,
    }));
  }, [value, campo.nombre_interno]);

  // Primer render con filas sin __id → escribirlas de vuelta con __id para fijarlas
  useEffect(() => {
    if (!Array.isArray(value)) return;
    const missing = value.some((r: any) => !r || !r.__id);
    if (!missing) return;

    const withIds = groupRows; // ya trae __id
    const commit = external
      ? external.onChange
      : (v: any) =>
          dispatch(
            setFieldValue({
              sessionId: sessionId!,
              nombreInterno: campo.nombre_interno,
              value: v,
              pageIndex: effectivePage,
            })
          );
    commit(withIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // una vez

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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
            <ActivityIndicator size="small" />
            <Body frame={referenceFrame} color="secondary" size="sm">
              Cargando grupo…
            </Body>
          </View>
        ) : groupError ? (
          <Body frame={referenceFrame} size="sm" style={{ color: colors.danger600 }}>
            {groupError}
          </Body>
        ) : null}

        {groupFields.length ? (
          <RepeatableGroup
            required={!!campo.requerido}
            fieldsTemplate={groupFields as any}
            entries={groupRows}
            minEntries={1}
            referenceFrame={referenceFrame}
            contentFrame={contentFrame}
            onChange={(nextRows) => {
              // Guardar tal cual (el slice ya filtra vacíos y preserva __id)
              const commit = external
                ? external.onChange
                : (v: any) =>
                    dispatch(
                      setFieldValue({
                        sessionId: sessionId!,
                        nombreInterno: campo.nombre_interno,
                        value: v,
                        pageIndex: effectivePage,
                      })
                    );

              commit(nextRows);
              onChangeValue?.(campo.nombre_interno, nextRows);
            }}
          >
            {({ campo: subCampo, row, setField }) => (
              <FieldRenderer
                campo={subCampo as any}
                referenceFrame={referenceFrame}
                contentFrame={contentFrame}
                external={{
                  value: row[subCampo.nombre_interno],
                  onChange: (val) => setField(subCampo.nombre_interno, val),
                }}
                pageIndex={effectivePage}
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
