// =============================================================
// src/api/client.ts – Axios + interceptores JWT
// =============================================================
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { ACCESS_KEY, API_BASE_KEY, REFRESH_KEY } from "./secure-keys";

export const getApiBase = async (): Promise<string> => {
  const v = await SecureStore.getItemAsync(API_BASE_KEY);
  if (!v) throw new Error("API base url no configurada");
  return v;
};

export const setApiBase = async (url: string) => {
  await SecureStore.setItemAsync(API_BASE_KEY, url);
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

// src/api/client.ts
let refreshing: Promise<{ accessToken: string; refreshToken?: string }> | null = null;

export const makeClient = async () => {
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
      const original = error.config;
      if (status !== 401 || original?._retry) throw error;

      const refresh = await getRefreshToken();
      if (!refresh) {
        await clearTokens();
        throw error;
      }

      try {
        if (!refreshing) {
          refreshing = (async () => {
            const resp = await axios.post(`${baseURL}/auth/refresh`, { refreshToken: refresh });
            const { accessToken, refreshToken } = resp.data;
            await setTokens(accessToken, refreshToken);
            return { accessToken, refreshToken };
          })();
        }
        const { accessToken } = await refreshing;
        original._retry = true;
        original.headers.Authorization = `Bearer ${accessToken}`;
        return instance.request(original);
      } catch (e) {
        await clearTokens();
        throw e;
      } finally {
        refreshing = null;
      }
    }
  );

  return instance;
};
