// src/forms/state/registerFormSessionListeners.ts
import {
  goToPage,
  groupAddRow,
  groupRemoveRow,
  groupSetRowField,
  persistCurrentSession,
  persistCursorIndex,
  setFieldValue,
  setStatus,
} from "@/forms/state/formSessionSlice";
import type { AppStartListening } from "@/store/listener";

const AUTOSAVE_DEBOUNCE_MS = 600;
const CURSOR_DEBOUNCE_MS = 350;

export const registerFormSessionListeners = (startAppListening: AppStartListening) => {
  console.log("[listeners] formSession listeners mounted");

  // 1) Campo simple
  startAppListening({
    actionCreator: setFieldValue,
    effect: async (action, api) => {
      const { sessionId } = action.payload;
      console.log("Listener setFieldValue triggered for session:", sessionId);
      api.cancelActiveListeners();
      await api.delay(AUTOSAVE_DEBOUNCE_MS);
      await api.dispatch(persistCurrentSession({ sessionId }));
    },
  });

  // 2) Campo en grupo
  startAppListening({
    actionCreator: groupSetRowField,
    effect: async (action, api) => {
      const { sessionId } = action.payload;
      api.cancelActiveListeners();
      await api.delay(AUTOSAVE_DEBOUNCE_MS);
      await api.dispatch(persistCurrentSession({ sessionId }));
    },
  });

  // 3) Agregar / eliminar filas del grupo
  startAppListening({
    actionCreator: groupAddRow,
    effect: async (action, api) => {
      const { sessionId } = action.payload;
      api.cancelActiveListeners();
      await api.delay(AUTOSAVE_DEBOUNCE_MS);
      await api.dispatch(persistCurrentSession({ sessionId }));
    },
  });

  startAppListening({
    actionCreator: groupRemoveRow,
    effect: async (action, api) => {
      const { sessionId } = action.payload;
      api.cancelActiveListeners();
      await api.delay(AUTOSAVE_DEBOUNCE_MS);
      await api.dispatch(persistCurrentSession({ sessionId }));
    },
  });

  // 4) Cursor de página
  startAppListening({
    actionCreator: goToPage,
    effect: async (action, api) => {
      const { sessionId } = action.payload;
      api.cancelActiveListeners();
      await api.delay(CURSOR_DEBOUNCE_MS);
      await api.dispatch(persistCursorIndex({ sessionId }));
    },
  });

  // 5) Cambiar estado del formulario
  startAppListening({
    actionCreator: setStatus,
    effect: async (action, api) => {
      const { sessionId } = action.payload;
      api.cancelActiveListeners();
      await api.delay(AUTOSAVE_DEBOUNCE_MS);
      await api.dispatch(persistCurrentSession({ sessionId }));
    },
  });
};
