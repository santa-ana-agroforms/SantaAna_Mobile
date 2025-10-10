// src/utils/appstate.ts
import { AppState } from "react-native";
import { onReconnectOnce } from "./network";

export const onActiveWithInternet = (cb: () => void) => {
  let prev = AppState.currentState;
  const sub = AppState.addEventListener("change", (state) => {
    if (prev.match(/inactive|background/) && state === "active") {
      onReconnectOnce(cb);
    }
    prev = state;
  });
  return () => sub.remove();
};
