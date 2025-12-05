// =============================================================
// src/auth/useAuth.ts – Hook de autenticación (QR o credenciales)
// =============================================================
import * as Device from "expo-device";
import { useCallback, useState } from "react";
import { clearTokens, makeClient, setApiBase, setTokens } from "../api/client";
import type { AuthUser, JwtTokens } from "../types";

const getGuatemalaDateTimeIsoString = () => {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Guatemala",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter
      .formatToParts(new Date())
      .reduce<Record<string, string>>((acc, part) => {
        if (part.type !== "literal") acc[part.type] = part.value;
        return acc;
      }, {});
    const { year, month, day, hour, minute, second } = parts;
    if (year && month && day && hour && minute && second) {
      return `${year}-${month}-${day}T${hour}:${minute}:${second}-06:00`;
    }
  } catch (err) {
    console.warn("[DATE] Guatemala timezone formatting failed:", err);
  }
  return new Date().toISOString();
};

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);

  const loginWithCredentials = useCallback(
    async (baseUrl: string, username: string, password: string) => {
      setLoading(true);
      try {
        await setApiBase(baseUrl);
        const api = await makeClient();
        const device_info = {
          brand: Device.brand,
          modelName: Device.modelName,
          osName: Device.osName,
          osVersion: Device.osVersion,
          type: Device.deviceType,
          name: Device.deviceName || "",
          modelId: Device.modelId || "",
          productName: Device.productName || "",
          // Poner la hora de Guatemala (UTC-6)
          dateTime: getGuatemalaDateTimeIsoString(),
        };
        const resp = await api.post("/auth/login", { username, password, device_info });
        const { accessToken, refreshToken, user } = resp.data as JwtTokens & {
          user: AuthUser;
        };
        await setTokens(accessToken, refreshToken);
        setUser(user);
        return user;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loginWithQr = useCallback(
    async (payload: {
      baseUrl: string;
      type: "magic" | "token";
      code?: string;
      token?: string;
    }) => {
      setLoading(true);
      try {
        await setApiBase(payload.baseUrl);
        if (payload.type === "token" && payload.token) {
          await setTokens(payload.token);
          const api = await makeClient();
          const me = await api.get("/auth/me");
          setUser(me.data as AuthUser);
          return me.data as AuthUser;
        }
        if (payload.type === "magic" && payload.code) {
          const api = await makeClient();
          const resp = await api.post("/auth/qr/login", { code: payload.code });
          const { accessToken, refreshToken, user } = resp.data as JwtTokens & {
            user: AuthUser;
          };
          await setTokens(accessToken, refreshToken);
          setUser(user);
          return user;
        }
        throw new Error("QR inválido");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    setUser(null);
    await clearTokens();
  }, []);

  return { user, loading, loginWithCredentials, loginWithQr, logout };
};
