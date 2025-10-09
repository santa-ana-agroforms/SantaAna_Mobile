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
  onChangeValue?: (name: string, value: unknown) => void; // (opcional) si el padre quiere interceptar
  /** Índice de la página; si no se pasa, se usa la actual del slice */
  pageIndex?: number;
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
const DEBUG = true;
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
}) => {
  const dispatch = useAppDispatch();
  const sessionId = useAppSelector(selectCurrentSessionId);
  const currentSession = useAppSelector(selectCurrentSession);
  const currentIndex = currentSession?.currentPageIndex ?? 0;
  const effectivePage = pageIndex ?? currentIndex;

  const label = campo.etiqueta || campo.nombre_interno;
  const help = campo.ayuda;

  const dbg = useDebugLogger(`${campo.nombre_interno}@p${effectivePage}`);

  // Valor SIEMPRE desde el slice (requiere sessionId)
  const valueSelector = sessionId
    ? selectFieldValue(sessionId, campo.nombre_interno, effectivePage)
    : () => undefined as any;
  const value = useAppSelector(valueSelector);

  // Commit → action al slice (+ evento opcional al padre)
  const onCommit = useCallback(
    (v: any) => {
      if (!sessionId) {
        dbg.log("onCommit skipped: no sessionId");
        return;
      }
      dbg.group("onCommit()", () => {
        dbg.log("dispatch setFieldValue", {
          nombreInterno: campo.nombre_interno,
          pageIndex: effectivePage,
          nextValuePreview:
            typeof v === "object" ? { type: typeof v, keys: Object.keys(v ?? {}) } : v,
        });
      });
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
    [dispatch, campo.nombre_interno, effectivePage, onChangeValue, sessionId]
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
    sessionId,
    currentIndex,
    effectivePage,
    valuePreview:
      typeof value === "object" ? { type: typeof value, isArray: Array.isArray(value) } : value,
  });

  // LOG: cambios de value
  const prevValueRef = useRef<any>(value);
  useEffect(() => {
    if (prevValueRef.current !== value) {
      dbg.group("value changed", () => {
        dbg.log("prev:", prevValueRef.current);
        dbg.log("next:", value);
      });
      prevValueRef.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // LOG: cambios de session/pageIndex
  const prevPgRef = useRef<number>(effectivePage);
  useEffect(() => {
    if (prevPgRef.current !== effectivePage) {
      dbg.log("effectivePage changed:", prevPgRef.current, "→", effectivePage);
      prevPgRef.current = effectivePage;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePage]);

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
      onChangeText={(t) => {
        dbg.log("onChangeText(text)", t);
        onCommit(t);
      }}
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
        dbg.log("onChangeText(number)", { raw: t, sanitized });
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
        onChange={(v) => {
          dbg.log("onChange(boolean)", v);
          onCommit(v);
        }}
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
        onChange={(v) => {
          dbg.log("onChange(list)", v);
          onCommit(v);
        }}
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
        onChange={(v) => {
          dbg.log("onChange(dataset)", v);
          onCommit(v);
        }}
        placeholder="Selecciona un valor…"
      />
      <Body frame={referenceFrame} color="secondary" size="xs" style={{ marginTop: 6 }}>
        Fuente externa (CSV)
        {"\n"}archivo: {campo.config?.file || "—"}
        {"\n"}columna: {campo.config?.column || "—"}
      </Body>
    </>
  );

  const renderDate = (kind: "date" | "hour") => {
    console.groupCollapsed(`🕒 renderDate(${kind})`);

    console.log("→ Redux value:", value, typeof value);

    const toUiDate = (s?: string | null): Date | null => {
      if (!s) return null;
      if (kind === "date") {
        const [y, m, d] = s.split("-").map(Number);
        const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
        console.log("↳ parseDateOnly:", dt, dt.toString());
        return dt;
      } else {
        const [H, M] = s.split(":").map(Number); // "HH:mm"
        const dt = new Date();
        dt.setHours(H ?? 0, M ?? 0, 0, 0);
        console.log("↳ parseTimeOnly:", dt, dt.toString());
        return dt;
      }
    };

    const toStoreStr = (d: Date | null): string | null => {
      if (!d) return null;
      if (kind === "date") {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const out = `${y}-${m}-${day}`;
        console.log("← guardando en Redux (fecha):", out);
        return out;
      } else {
        const H = String(d.getHours()).padStart(2, "0");
        const M = String(d.getMinutes()).padStart(2, "0");
        const out = `${H}:${M}`;
        console.log("← guardando en Redux (hora):", out);
        return out;
      }
    };

    const uiValue: Date | null = typeof value === "string" ? toUiDate(value) : null;
    console.log("→ uiValue to DateTimeField:", uiValue, uiValue?.toString());

    console.groupEnd();

    return (
      <DateTimeField
        mode={kind === "date" ? "date" : "time"}
        value={uiValue} // <-- Debe ser Date|null
        onChange={(d) => {
          console.log("⏰ DateTimeField onChange:", d, d?.toString());
          onCommit(toStoreStr(d));
        }}
        label={label}
        required={campo.requerido}
        placeholder={kind === "date" ? "Seleccionar fecha" : "Seleccionar hora"}
        frame={referenceFrame}
      />
    );
  };

  const renderCalc = () => {
    const calcValue = value; // el slice recalcula con `recomputeAllCalcs`
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
    // Throttle simple para evitar spam de commits
    let t: any = null;
    let lastRef: any = null;

    const throttledCommit = (next: any) => {
      if (typeof next === "string" && next === lastRef) return;
      if (Array.isArray(next) && Array.isArray(lastRef) && next.length === lastRef.length) return;
      if (t) return; // ventana de throttle activa
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
      dbg.log("groupId empty → reset group state");
      setGroupLoading(false);
      setGroupError(null);
      setGroupData(null);
      return;
    }

    setGroupLoading(true);
    setGroupError(null);

    dbg.group("fetch group", () => {
      dbg.log("getGroupOrFetch", { groupId });
    });

    (async () => {
      try {
        const g = await getGroupOrFetch(groupId);
        if (!cancelled) {
          dbg.log("group fetched", {
            sameRef: groupData === g,
            fieldsCount: (g as any)?.fields?.length ?? (g as any)?.campos?.length ?? 0,
          });
          setGroupData((prev) => (prev === g ? prev : (g as GroupTreeLite)));
        }
      } catch (e: any) {
        if (!cancelled) {
          dbg.log("group fetch error", e?.message);
          setGroupError(e?.message ?? "No se pudo cargar el grupo.");
        }
      } finally {
        if (!cancelled) {
          setGroupLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      dbg.log("cancel group fetch", { groupId });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            onChange={(next) => {
              if (!sessionId) return;
              dbg.log("RepeatableGroup onChange → setFieldValue(arrayLen)", {
                len: Array.isArray(next) ? next.length : -1,
              });
              dispatch(
                setFieldValue({
                  sessionId,
                  nombreInterno: campo.nombre_interno,
                  value: next,
                  pageIndex: effectivePage,
                })
              );
            }}
            referenceFrame={referenceFrame}
            contentFrame={contentFrame}
          >
            {({ campo: subCampo, onChange }) => (
              <FieldRenderer
                campo={subCampo}
                referenceFrame={referenceFrame}
                contentFrame={contentFrame}
                // subcampos viven “local” al grupo y se consolidan con onChange(next)
                onChangeValue={(_n, v) => {
                  dbg.log("subField onChangeValue (bubble up)", {
                    subField: subCampo?.nombre_interno,
                  });
                  onChange(v);
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
