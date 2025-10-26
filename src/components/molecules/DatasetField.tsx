import { getDatasetLabelLocal, getDatasetOptionsLocal } from "@/api/datasets";
import DatasetSelect from "@/components/atoms/DatasetSelect";
import { Body } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, TextInput, View } from "react-native";

type Frame = { width: number; height: number };
type Primitive = string | number | boolean;

type Props = {
  campoId: string;
  value?: Primitive | null;
  onChange?: (v: Primitive | undefined) => void;
  frame: Frame;
  placeholder?: string;
  pageSize?: number; // ← ya no se usa; lo dejo por compatibilidad, pero puedes removerlo
  showSearch?: boolean;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const normalizeRows = (rows: any[]) =>
  rows.map((r) => {
    const hasKey = r && typeof r === "object" && "key" in r;
    const hasValue = r && typeof r === "object" && "value" in r;
    const rawKey = hasKey ? (r as any).key : hasValue ? (r as any).value : undefined;
    const labelFromRow = r && typeof r === "object" && "label" in r ? (r as any).label : undefined;

    return {
      label: labelFromRow ?? String(rawKey ?? ""),
      value: (rawKey ?? "") as Primitive,
    };
  });

/**
 * DatasetField SIN paginado:
 * - Carga única de todos los elementos (según q si showSearch está activo).
 * - Mantiene loader mientras trae datos.
 * - Inyecta el displayLabel del valor actual si no está en la lista.
 */
const DatasetField: React.FC<Props> = ({
  campoId,
  value,
  onChange,
  frame,
  placeholder = "Selecciona un valor…",
  // pageSize = 50, // ← sin uso
  showSearch = false,
}) => {
  // console.debug(`[DatasetField] Render para campoId=${campoId} con value=${value}`);
  const [q, setQ] = useState<string>("");
  const [items, setItems] = useState<{ label: string; value: Primitive }[]>([]);
  const [loading, setLoading] = useState(false);
  const [displayLabel, setDisplayLabel] = useState<string | null>(null);

  // Cargar etiqueta del valor actual
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (value == null) {
        setDisplayLabel(null);
        return;
      }
      try {
        const label = await getDatasetLabelLocal(campoId, String(value));
        if (!cancelled) setDisplayLabel(label ?? null);
      } catch {
        if (!cancelled) setDisplayLabel(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campoId, value]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const opts: any = {};
      const trimmed = q?.trim();
      if (showSearch && trimmed) opts.q = trimmed;

      const rowsRaw = await getDatasetOptionsLocal(campoId, opts);
      const rows = Array.isArray(rowsRaw) ? rowsRaw : [];
      const norm = normalizeRows(rows);
      setItems(norm);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [campoId, q, showSearch]);

  // 3) Dispara SIEMPRE al montar y cuando cambie q/campoId/showSearch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await fetchAll();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchAll]);
  const effectiveItems = useMemo(() => {
    if (
      (value ?? null) != null &&
      !items.some((it) => String(it.value) === String(value)) &&
      displayLabel
    ) {
      return [{ label: displayLabel, value: value as Primitive }, ...items];
    }
    return items;
  }, [items, value, displayLabel]);

  const dims = useMemo(() => {
    const minSide = Math.min(frame.width, frame.height);
    return {
      pad: clamp(minSide * 0.014, 10, 16),
      gap: clamp(minSide * 0.012, 8, 14),
      radius: clamp(minSide * 0.018, 8, 12),
    };
  }, [frame]);

  return (
    <View style={{ gap: dims.gap }} pointerEvents="box-none">
      {showSearch ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: dims.radius,
            paddingHorizontal: dims.pad,
            paddingVertical: dims.pad * 0.6,
            backgroundColor: colors.neutral0,
          }}
        >
          <TextInput placeholder="Buscar…" value={q} onChangeText={setQ} style={{ padding: 0 }} />
        </View>
      ) : null}

      {/* Select */}
      <DatasetSelect
        frame={frame}
        items={effectiveItems}
        value={(value as Primitive) ?? undefined}
        onChange={onChange}
        placeholder={placeholder}
        allowDeselect
        showNoneOption
      />

      {/* Loader inline */}
      {loading ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ActivityIndicator />
          <Body frame={frame} size="sm" color="secondary">
            Cargando…
          </Body>
        </View>
      ) : null}
    </View>
  );
};

export default DatasetField;
