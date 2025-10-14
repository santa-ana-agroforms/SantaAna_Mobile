// src/screens/forms/useInstanceSelectorState.ts
import type { EntryPreview } from "@/components/molecules/InstanceSelector";
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

  const openForForm = useCallback((formId: string) => {
    setEntries([
      {
        id: `${formId}-1`,
        instanceName: "Registro 1",
        status: "in_progress",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: `${formId}-2`,
        instanceName: "Registro 2",
        status: "ready_for_submit",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: `${formId}-3`,
        instanceName: "Registro 3",
        status: "submitted",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: `${formId}-4`,
        instanceName: "Registro 4",
        status: "submitted",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: `${formId}-5`,
        instanceName: "Registro 5",
        status: "submitted",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: `${formId}-6`,
        instanceName: "Registro 6",
        status: "submitted",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);
    setAllowNew(true);
    setPeriodLabel("hoy");
    setVisible(true);
  }, []);

  const close = useCallback(() => setVisible(false), []);

  return { visible, entries, allowNew, periodLabel, openForForm, close, computeDecorators };
};
