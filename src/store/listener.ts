// src/store/listener.ts
import type { TypedStartListening } from "@reduxjs/toolkit";
import { createListenerMiddleware } from "@reduxjs/toolkit";
import type { AppDispatch, RootState } from "./index"; // importa SOLO tipos

export const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>();

export type AppStartListening = TypedStartListening<RootState, AppDispatch>;
export const startAppListening = listenerMiddleware.startListening as AppStartListening;
