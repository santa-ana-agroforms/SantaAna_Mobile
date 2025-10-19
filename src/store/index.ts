import formSessionReducer from "@/forms/state/formSessionSlice";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import {
  FLUSH,
  PAUSE,
  PERSIST,
  persistReducer,
  persistStore,
  PURGE,
  REGISTER,
  REHYDRATE,
} from "redux-persist";
import { listenerMiddleware } from "./listener"; // 👈 importa la instancia, NO registra aquí

const rootReducer = combineReducers({ formSession: formSessionReducer });

const persistConfig = { key: "root", storage: AsyncStorage };
const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store: ReturnType<typeof configureStore> = configureStore({
  reducer: persistedReducer,
  devTools: __DEV__,
  middleware: (getDM) =>
    getDM({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        ignoredActionPaths: ["register", "rehydrate"],
      },
      immutableCheck: false,
    }).prepend(listenerMiddleware.middleware), // 👈 RTK recomienda prepend para listeners
});

export const persistor = persistStore(store);

// Tipos del store real
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Exportá startAppListening DESDE listener.ts (no acá) para evitar el ciclo
export { startAppListening } from "./listener";
