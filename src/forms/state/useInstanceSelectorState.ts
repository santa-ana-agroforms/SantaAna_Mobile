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

export const useInstanceSelectorState = () => {
  const [visible, setVisible] = useState(false);
  const [entries, setEntries] = useState<EntryPreview[]>([]);
  const [allowNew, setAllowNew] = useState(true);
  const [periodLabel, setPeriodLabel] = useState("hoy");

  const computeDecorators = useCallback((freq: Frequency): FormListDecorators => {
    const label =
      freq === "daily"
        ? "hoy"
        : freq === "weekly"
          ? "esta semana"
          : freq === "monthly"
            ? "este mes"
            : "actual";
    // mocks visuales; tu backend los reemplaza luego
    return {
      periodLabel: label,
      draftCount: 2,
      readyCount: 1,
      submittedCount: 3,
      limit: 5,
      reachedLimit: 6 >= 5,
      suspended: false,
    };
  }, []);

  const openForForm = useCallback(async (formId: string) => {
    // Obtain entries from db/backend según formId
    const mockEntries: SavedEntry[] = (await getEntriesByFormId(formId)) || [];

    const previews: EntryPreview[] = mockEntries.map((e) => ({
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
