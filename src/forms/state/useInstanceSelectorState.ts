// src/screens/forms/useInstanceSelectorState.ts
import type { EntryPreview } from "@/components/molecules/InstanceSelector";
import { getEntriesByFormId, SavedEntry } from "@/db/form-entries";
import { useCallback, useState } from "react";

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
  // Semana iniciando en lunes (ajusta si quieres domingo)
  const x = new Date(d);
  const day = x.getDay(); // 0-dom ... 6-sáb
  const delta = (day + 6) % 7; // 0 si lunes
  x.setDate(x.getDate() - delta);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfWeek = (d = new Date()) => {
  const start = startOfWeek(d);
  const x = new Date(start);
  x.setDate(start.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
};
const startOfMonth = (d = new Date()) => {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
};
const endOfMonth = (d = new Date()) => {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
};

const getPeriodBounds = (
  freq: Frequency
): { from: Date | null; to: Date | null; label: string } => {
  if (freq === "daily") return { from: startOfDay(), to: endOfDay(), label: "hoy" };
  if (freq === "weekly") return { from: startOfWeek(), to: endOfWeek(), label: "esta semana" };
  if (freq === "monthly") return { from: startOfMonth(), to: endOfMonth(), label: "este mes" };
  return { from: null, to: null, label: "actual" };
};

// Si tienes una política de límites por periodo, define aquí.
// Devuelve null si no aplica límite.
const getFormPeriodLimit = (formId: string, freq: Frequency): number | null => {
  // TODO: reemplazar con tu regla real (por ejemplo, leer de config del formulario)
  // Ejemplos:
  // - if (freq === "daily" && formId === "FORM_X") return 5;
  // - if (freq === "monthly") return 50;
  console.log(`Checking limit for form ${formId} with frequency ${freq}`);
  return null;
};

export const useInstanceSelectorState = () => {
  const [visible, setVisible] = useState(false);
  const [entries, setEntries] = useState<EntryPreview[]>([]);
  const [allowNew, setAllowNew] = useState(true);
  const [periodLabel, setPeriodLabel] = useState("hoy");

  const computeDecorators = useCallback(
    async (formId: string, freq: Frequency): Promise<FormListDecorators> => {
      const { from, to, label } = getPeriodBounds(freq);

      // 1) Traer entradas del formulario
      const raw: SavedEntry[] = (await getEntriesByFormId(formId)) || [];

      console.log(JSON.stringify(raw, null, 2));

      // 2) Filtrar por periodo si aplica (usamos filled_at_local como referencia)
      const filtered = raw.filter((e) => {
        const ts = new Date(e.filled_at_local).getTime();
        if (!from || !to) return true;
        return ts >= from.getTime() && ts <= to.getTime();
      });

      // 3) Mapear y contar por estado
      let draftCount = 0;
      let readyCount = 0;
      let submittedCount = 0;

      console.log(
        `Filtered entries for form ${formId} in period ${label}:`,
        JSON.stringify(filtered, null, 2)
      );

      for (const e of filtered) {
        // Normalizamos al esquema UI
        const status =
          e.status === "pending"
            ? "in_progress"
            : e.status === "synced"
              ? "submitted"
              : "ready_for_submit";

        if (status === "in_progress") draftCount++;
        else if (status === "ready_for_submit") readyCount++;
        else submittedCount++;
      }

      // 4) Límite / estado suspendido (si aplica)
      const limit = getFormPeriodLimit(formId, freq);
      const total = filtered.length;
      const reachedLimit = limit != null ? total >= limit : false;
      const suspended = false; // TODO: aplica tu bandera real de suspensión si la tienes

      return {
        periodLabel: label,
        draftCount,
        readyCount,
        submittedCount,
        limit,
        reachedLimit,
        suspended,
      };
    },
    []
  );

  const openForForm = useCallback(async (formId: string) => {
    const saved: SavedEntry[] = (await getEntriesByFormId(formId)) || [];

    const previews: EntryPreview[] = saved.map((e) => ({
      id: e.local_id,
      instanceName: e.form_name,
      createdAt: new Date(e.filled_at_local).getTime(),
      updatedAt: new Date(e.filled_at_local).getTime(),
      status:
        e.status === "pending"
          ? "in_progress"
          : e.status === "synced"
            ? "submitted"
            : "ready_for_submit",
    }));

    setEntries(previews);
    setAllowNew(true);
    setPeriodLabel("hoy");
    setVisible(true);
  }, []);

  const close = useCallback(() => setVisible(false), []);

  return { visible, entries, allowNew, periodLabel, openForForm, close, computeDecorators };
};
