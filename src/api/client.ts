// =============================================================
// src/api/client.ts – Axios + interceptores JWT
// =============================================================
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { ACCESS_KEY, API_BASE_KEY, REFRESH_KEY } from "./secure-keys";

export async function getApiBase(): Promise<string> {
  const v = await SecureStore.getItemAsync(API_BASE_KEY);
  if (!v) throw new Error("API base url no configurada");
  return v;
}

export async function setApiBase(url: string) {
  await SecureStore.setItemAsync(API_BASE_KEY, url);
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

export async function makeClient() {
  const baseURL = await getApiBase();
  const instance = axios.create({ baseURL, timeout: 20000 });

  instance.interceptors.request.use(async (config) => {
    const access = await getAccessToken();
    if (access) config.headers.Authorization = `Bearer ${access}`;
    return config;
  });

  instance.interceptors.response.use(
    (res) => res,
    async (error) => {
      const status = error?.response?.status;
      if (status === 401) {
        const refresh = await getRefreshToken();
        if (!refresh) throw error;
        // intentar refrescar
        try {
          const baseURL = await getApiBase();
          const resp = await axios.post(`${baseURL}/auth/refresh`, {
            refreshToken: refresh,
          });
          const { accessToken, refreshToken } = resp.data;
          await setTokens(accessToken, refreshToken);
          error.config.headers.Authorization = `Bearer ${accessToken}`;
          return instance.request(error.config);
        } catch (e) {
          await clearTokens();
        }
      }
      throw error;
    }
  );

  return instance;
}
