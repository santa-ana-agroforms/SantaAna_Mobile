// src/utils/appstate.ts
import { AppState } from "react-native";
import { isOnline, onReconnectOnce } from "./network";

export const onActiveWithInternet = (cb: () => void) => {
  let prev = AppState.currentState;
  let cancelNet: (() => void) | null = null;

  const armNetGate = async () => {
    // si ya hay internet, ejecuta de una
    if (await isOnline()) {
      cb();
      return;
    }
    // si no, espera el primer reconnect
    cancelNet?.();
    cancelNet = onReconnectOnce(cb);
  };

  // correr una vez al montar
  armNetGate();

  const sub = AppState.addEventListener("change", (state) => {
    if (prev.match(/inactive|background/) && state === "active") {
      armNetGate();
    }
    prev = state;
  });

  return () => {
    sub.remove();
    cancelNet?.();
  };
};
