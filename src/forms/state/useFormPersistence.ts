// src/forms/state/useFormPersistence.ts
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useCallback } from "react";
import {
  fetchEntriesSummary,
  initSessionFromSaved,
  persistCurrentSession,
  selectCurrentSessionId,
} from "./formSessionSlice";

export const useFormPersistence = () => {
  const dispatch = useAppDispatch();
  const currentSessionId = useAppSelector(selectCurrentSessionId);
  const entriesSummary = useAppSelector((s) => s.formSession.entriesSummary);
  const loading = useAppSelector((s) => s.formSession.loading);
  const error = useAppSelector((s) => s.formSession.error);

  const saveNow = useCallback(
    async (sessionId?: string) => {
      const sid = sessionId ?? currentSessionId;
      if (!sid) throw new Error("No hay sesión activa para guardar");
      await dispatch(persistCurrentSession({ sessionId: sid })).unwrap();
      return sid;
    },
    [dispatch, currentSessionId]
  );

  const refreshSummary = useCallback(async () => {
    await dispatch(fetchEntriesSummary()).unwrap();
  }, [dispatch]);

  const loadFromLocal = useCallback(
    async (local_id: string) => {
      await dispatch(initSessionFromSaved({ local_id })).unwrap();
    },
    [dispatch]
  );

  return {
    currentSessionId,
    entriesSummary,
    loading,
    error,
    saveNow,
    refreshSummary,
    loadFromLocal,
  };
};
