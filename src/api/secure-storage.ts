// src/api/secure-storage.ts
import * as SecureStore from "expo-secure-store";

import { ACCESS_KEY, API_BASE_KEY, REFRESH_KEY } from "./secure-keys";

// ---- helpers ----
export const setApiBase = async (url: string) => {
  await SecureStore.setItemAsync(API_BASE_KEY, url);
};

export const getApiBase = async (): Promise<string> => {
  const v = await SecureStore.getItemAsync(API_BASE_KEY);
  if (!v) throw new Error("API base url no configurada");
  return v;
};

export const setTokens = async (access: string, refresh?: string) => {
  await SecureStore.setItemAsync(ACCESS_KEY, access);
  if (refresh) await SecureStore.setItemAsync(REFRESH_KEY, refresh);
};

export const getAccessToken = async () => {
  return SecureStore.getItemAsync(ACCESS_KEY);
};

export const getRefreshToken = async () => {
  return SecureStore.getItemAsync(REFRESH_KEY);
};

export const clearTokens = async () => {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
};
