// screens/QrLoginOnboarding.tsx
import { getApiBase, makeClient, setApiBase, setTokens } from "@/api/client";
import { fetchAndSaveForms } from "@/api/forms";
import { Body } from "@/components/atoms/Typography";
import QrIntroSection from "@/components/molecules/QrIntroSection";
import { colors } from "@/theme/tokens";
import type { AuthUser } from "@/types";
import NetInfo from "@react-native-community/netinfo";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Image, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { QrPayload } from "../auth/qrTypes";
import { isQrPayload } from "../auth/qrTypes";

type Props = {
  endpoint?: string;
  baseUrl?: string;
  autoSync?: boolean;
  onSuccess?: (user: AuthUser) => void;
};

type Frame = { width: number; height: number };
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const QrLoginOnboarding: React.FC<Props> = ({
  endpoint = "/auth/qr/login",
  baseUrl,
  autoSync = true,
  onSuccess,
}) => {
  // Frames base (sin PageScaffold)
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const referenceFrame: Frame = { width, height: height - insets.top - insets.bottom };
  // Escalas/tamaños derivados
  const minSide = Math.min(referenceFrame.width, referenceFrame.height);
  const baseRem = clamp(minSide * 0.042, 14, 18);

  const pad = clamp(minSide * 0.02, 12, 20);
  const titleSize = clamp(baseRem * 3.0, 22, 40);
  const footSize = clamp(baseRem * 1.4, 12, 18);
  const heroSize = clamp(minSide * 0.45, 180, 280);

  // Estado
  const [, setModalOpen] = useState(false);
  const [apiUrlInput, setApiUrlInput] = useState<string>("");
  const [statusText, setStatusText] = useState<string | null>(null);
  const [me, setMe] = useState<AuthUser | null>(null);

  // Guards
  const scanBusyRef = useRef(false);
  const loginInFlightRef = useRef(false);
  const syncAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const saved = await getApiBase();
        setApiUrlInput(saved || baseUrl || "");
      } catch {}
    })();
  }, [baseUrl]);

  const parseAndLogin = useCallback(async (raw: string) => {
    if (scanBusyRef.current) return;
    scanBusyRef.current = true;
    setStatusText("Verificando QR…");
    try {
      const obj = JSON.parse(raw);
      if (!isQrPayload(obj)) throw new Error("El QR no contiene {sid, nonce, sig}.");
      await doLogin(obj);
    } catch (e: any) {
      setStatusText(null);
      Alert.alert("QR inválido", e?.message ?? "El QR escaneado no es JSON.");
    } finally {
      setModalOpen(false);
      scanBusyRef.current = false;
    }
  }, []);

  const doLogin = useCallback(
    async (p: QrPayload) => {
      if (loginInFlightRef.current) return;
      loginInFlightRef.current = true;

      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        Alert.alert("Sin conexión", "Se requiere internet para el primer login.");
        setStatusText(null);
        loginInFlightRef.current = false;
        return;
      }

      try {
        if (apiUrlInput) await setApiBase(apiUrlInput);
        else if (baseUrl) await setApiBase(baseUrl);

        const api = await makeClient();
        const resp = await api.post(endpoint, { sid: p.sid, nonce: p.nonce, sig: p.sig });
        const { access_token: accessToken, refreshToken, user } = resp.data ?? {};
        if (!accessToken) throw new Error("No se recibió accessToken del servidor.");

        await setTokens(accessToken, refreshToken);

        let u: AuthUser | null = user ?? null;
        if (!u) {
          setStatusText("Cargando perfil…");
          const meResp = await api.get("/auth/me");
          u = meResp.data as AuthUser;
        }
        setMe(u);

        if (autoSync && u) {
          setStatusText("Sincronizando formularios…");

          syncAbortRef.current?.abort();
          const controller = new AbortController();
          syncAbortRef.current = controller;

          try {
            await fetchAndSaveForms(
              (v) => setStatusText(v ? "Sincronizando formularios…" : "¡Listo!"),
              controller.signal
            );
          } catch (syncErr: any) {
            if (!controller.signal.aborted) {
              console.warn("[SYNC] fallo en fetchAndSaveForms:", syncErr);
              Alert.alert(
                "Advertencia",
                "El inicio de sesión fue correcto, pero falló la sincronización inicial. Podrás sincronizar más tarde desde el Home."
              );
            }
          }
        }

        setStatusText("¡Listo!");
        onSuccess?.(u!);
      } catch (e: any) {
        const msg =
          e?.response?.data?.message || e?.message || "No se pudo completar el login por QR.";
        Alert.alert("Error de login", msg);
        console.error("[LOGIN] error:", e);
      } finally {
        loginInFlightRef.current = false;
        setTimeout(() => setStatusText(null), 1200);
      }
    },
    [apiUrlInput, baseUrl, endpoint, autoSync, onSuccess]
  );

  useEffect(() => () => syncAbortRef.current?.abort(), []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ flex: 1, width: "100%", paddingHorizontal: pad }}>
        {/* Título */}
        <Body
          frame={referenceFrame}
          weight="bold"
          style={{ fontSize: titleSize, textAlign: "center", marginTop: baseRem * 2 }}
        >
          SANTA ANA APP
        </Body>

        {/* Ilustración */}
        <Image
          source={require("@/../assets/images/qrLogin.png")}
          style={{
            width: heroSize,
            height: heroSize,
            resizeMode: "contain",
            alignSelf: "center",
            marginVertical: baseRem * 2,
          }}
        />

        <QrIntroSection
          referenceFrame={referenceFrame}
          user={me}
          statusText={statusText}
          setStatusText={setStatusText}
          onQr={parseAndLogin}
        />

        {/* Footer dentro de safe area */}
        <View
          style={{
            position: "absolute",
            bottom: insets.bottom ? insets.bottom : pad,
            left: pad,
            right: pad,
            alignItems: "center",
          }}
        >
          <Body frame={referenceFrame} style={{ textAlign: "center", fontSize: footSize }}>
            © 2019 Compañía Agrícola Industrial Santa Ana, S. A. - All Rights Reserved
          </Body>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default QrLoginOnboarding;
