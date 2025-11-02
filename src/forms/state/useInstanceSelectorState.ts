// src/screens/forms/useInstanceSelectorState.ts
import type { EntryPreview } from "@/components/molecules/InstanceSelector";
import { getEntriesByFormId, SavedEntry } from "@/db/form-entries";
import { useCallback, useRef, useState } from "react";

type Frequency = "none" | "daily" | "weekly" | "monthly";

export type FormListDecorators = {
  periodLabel?: string;
  draftCount?: number;
  readyCount?: number;
  submittedCount?: number;
  limit?: number | null;
  reachedLimit?: boolean;
  suspended?: boolean;
};

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
const startOfWeek = (d = new Date()) => {
  const x = new Date(d);
  const day = x.getDay();
  const delta = (day + 6) % 7;
  x.setDate(x.getDate() - delta);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfWeek = (d = new Date()) => {
  const s = startOfWeek(d);
  const x = new Date(s);
  x.setDate(s.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
};
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
const endOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

const getPeriodBounds = (
  freq: Frequency
): { from: Date | null; to: Date | null; label: string } => {
  if (freq === "daily") return { from: startOfDay(), to: endOfDay(), label: "hoy" };
  if (freq === "weekly") return { from: startOfWeek(), to: endOfWeek(), label: "esta semana" };
  if (freq === "monthly") return { from: startOfMonth(), to: endOfMonth(), label: "este mes" };
  return { from: null, to: null, label: "actual" };
};

const getFormPeriodLimit = (_formId: string, _freq: Frequency): number | null => {
  return null;
};

export const useInstanceSelectorState = () => {
  const [visible, setVisible] = useState(false);
  const [entries, setEntries] = useState<EntryPreview[]>([]);
  const [allowNew, setAllowNew] = useState(true);
  const [periodLabel, setPeriodLabel] = useState("hoy");

  // guardamos el formId actual para poder refetchear después de enviar
  const currentFormIdRef = useRef<string | null>(null);

  const mapStatus = (
    s: string | null | undefined
  ): "in_progress" | "ready_for_submit" | "submitted" => {
    if (s === "synced") return "submitted";
    if (s === "pending") return "in_progress";
    return "ready_for_submit";
  };

  const loadEntriesForForm = useCallback(async (formId: string): Promise<EntryPreview[]> => {
    const raw: SavedEntry[] = (await getEntriesByFormId(formId)) || [];
    return raw.map((e) => ({
      id: e.local_id,
      instanceName: e.form_name,
      createdAt: new Date(e.filled_at_local).getTime(),
      updatedAt: new Date(e.filled_at_local).getTime(),
      status: mapStatus(e.status),
    }));
  }, []);

  const computeDecorators = useCallback(
    async (formId: string, freq: Frequency): Promise<FormListDecorators> => {
      const { from, to, label } = getPeriodBounds(freq);
      const raw: SavedEntry[] = (await getEntriesByFormId(formId)) || [];

      const filtered = raw.filter((e) => {
        const ts = new Date(e.filled_at_local).getTime();
        if (!from || !to) return true;
        return ts >= from.getTime() && ts <= to.getTime();
      });

      let draftCount = 0;
      let readyCount = 0;
      let submittedCount = 0;

      for (const e of filtered) {
        const status = mapStatus(e.status);
        if (status === "in_progress") draftCount++;
        else if (status === "ready_for_submit") readyCount++;
        else submittedCount++;
      }

      const limit = getFormPeriodLimit(formId, freq);
      const total = filtered.length;
      const reachedLimit = limit != null ? total >= limit : false;

      return {
        periodLabel: label,
        draftCount,
        readyCount,
        submittedCount,
        limit,
        reachedLimit,
        suspended: false,
      };
    },
    []
  );

  const openForForm = useCallback(
    async (formId: string) => {
      currentFormIdRef.current = formId;
      const previews = await loadEntriesForForm(formId);
      setEntries(previews);
      setAllowNew(true);
      setPeriodLabel("hoy");
      setVisible(true);
    },
    [loadEntriesForForm]
  );

  const refetch = useCallback(async () => {
    const formId = currentFormIdRef.current;
    if (!formId) return;
    const previews = await loadEntriesForForm(formId);
    setEntries(previews);
  }, [loadEntriesForForm]);

  // ✅ update optimista: mueve el item a "submitted" en el modal, sin esperar a la DB
  const optimisticMarkSubmitted = useCallback((localId: string) => {
    setEntries((prev) => prev.map((e) => (e.id === localId ? { ...e, status: "submitted" } : e)));
  }, []);

  const close = useCallback(() => setVisible(false), []);

  return {
    visible,
    entries,
    allowNew,
    periodLabel,
    openForForm,
    close,
    computeDecorators,
    refetch,
    optimisticMarkSubmitted,
  };
};
