// =============================================================
// src/auth/useAuth.ts – Hook de autenticación (QR o credenciales)
// =============================================================
import { useCallback, useState } from "react";
import { clearTokens, makeClient, setApiBase, setTokens } from "../api/client";
import type { AuthUser, JwtTokens } from "../types";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);

  const loginWithCredentials = useCallback(
    async (baseUrl: string, username: string, password: string) => {
      setLoading(true);
      try {
        await setApiBase(baseUrl);
        const api = await makeClient();
        const resp = await api.post("/auth/login", { username, password });
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
}
