// src/api/secure-storage.ts
import * as SecureStore from "expo-secure-store";

import { ACCESS_KEY, API_BASE_KEY, REFRESH_KEY } from "./secure-keys";

// ---- helpers ----
export async function setApiBase(url: string) {
  await SecureStore.setItemAsync(API_BASE_KEY, url);
}

export async function getApiBase(): Promise<string> {
  const v = await SecureStore.getItemAsync(API_BASE_KEY);
  if (!v) throw new Error("API base url no configurada");
  return v;
}

export async function setTokens(access: string, refresh?: string) {
  await SecureStore.setItemAsync(ACCESS_KEY, access);
  if (refresh) await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}
