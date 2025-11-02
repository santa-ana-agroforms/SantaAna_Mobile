// screens/QrLoginOnboarding.tsx
import { getApiBase, makeClient, setApiBase, setTokens } from "@/api/client";
import { fetchAndSaveForms } from "@/api/forms";
import Input from "@/components/atoms/Input";
import Label from "@/components/atoms/Label";
import NoticeBar, { NoticeKind } from "@/components/atoms/NoticeBar";
import { Body } from "@/components/atoms/Typography";
import QrIntroSection from "@/components/molecules/QrIntroSection";
import { colors } from "@/theme/tokens";
import type { AuthUser } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { QrPayload } from "../auth/qrTypes";
import { isQrPayload } from "../auth/qrTypes";

type Props = {
  endpoint?: string;
  baseUrl?: string;
  autoSync?: boolean;
  credsEndpoint?: string;
  usernameFieldName?: "username" | "email" | "nombre_usuario";
};

type Frame = { width: number; height: number };
type Mode = "qr" | "creds";

/** ========== Notice state extendido para messageKey/params ========== */
type NoticeState = {
  kind: NoticeKind;
  /** Opción A (legacy): texto directo */
  text?: string;
  /** Opción B (recomendada): clave del diccionario NoticeBar */
  messageKey?: string;
  /** Parámetros para interpolar el mensaje (opcional) */
  params?: Record<string, string | number>;
  autoHideMs?: number;
} | null;

/** ========== Helpers de mapeo de errores → messageKey ========== */
type ErrorCtx = "qr" | "creds" | "sync" | "generic";

const includesAny = (s: string, arr: string[]) => {
  const t = (s || "").toLowerCase();
  return arr.some((x) => t.includes(x.toLowerCase()));
};

const toKeyFromStatus = (
  status: number | null,
  ctx: ErrorCtx
): { kind: NoticeKind; messageKey: string } | null => {
  if (status == null) return null;
  if (status === 401)
    return {
      kind: "error",
      messageKey: ctx === "creds" ? "auth.invalid_creds" : "auth.expired_session",
    };
  if (status === 403) return { kind: "error", messageKey: "api.forbidden" };
  if (status === 404) return { kind: "error", messageKey: "api.not_found" };
  if (status === 422 || status === 400) {
    return { kind: "error", messageKey: ctx === "qr" ? "qr.invalid" : "api.validation" };
  }
  if (status === 429) return { kind: "warning", messageKey: "auth.rate_limited" };
  if (status >= 500)
    return { kind: "error", messageKey: ctx === "sync" ? "sync.server_error" : "api.server_error" };
  return null;
};

const translateApiErrorToNotice = (
  ctx: ErrorCtx,
  err: any
): { kind: NoticeKind; messageKey: string } => {
  const status: number | null =
    typeof err?.response?.status === "number" ? err.response.status : null;
  const code = String(err?.code || "");
  const msg = String(err?.message || "");
  const serverMsg = String(err?.response?.data?.message || "");

  // Red / timeout / SSL / DNS
  if (code === "ERR_NETWORK" || includesAny(msg, ["network", "failed to fetch"])) {
    return {
      kind: "error",
      messageKey:
        ctx === "creds" || ctx === "qr" ? "auth.offline_first_login" : "net.no_connection",
    };
  }
  if (code === "ECONNABORTED" || includesAny(msg, ["timeout"])) {
    return { kind: "error", messageKey: "net.timeout" };
  }
  if (includesAny(msg + serverMsg, ["ssl", "certificate", "hostname"])) {
    return { kind: "error", messageKey: "net.ssl" };
  }
  if (includesAny(msg + serverMsg, ["dns", "resolve"])) {
    return { kind: "error", messageKey: "net.dns" };
  }

  // HTTP status
  const byStatus = toKeyFromStatus(status, ctx);
  if (byStatus) return byStatus;

  // Casos específicos
  if (ctx === "qr" && includesAny(serverMsg, ["nonce", "expired", "invalid", "signature"])) {
    return { kind: "error", messageKey: "qr.invalid" };
  }

  // Fallback
  return { kind: "error", messageKey: ctx === "qr" ? "qr.login_failed" : "generic.error" };
};

const QrLoginOnboarding: React.FC<Props> = ({
  endpoint = "/auth/qr/login",
  baseUrl,
  autoSync = true,
  credsEndpoint = "/auth/login",
  usernameFieldName = "nombre_usuario",
}) => {
  // Frames
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const referenceFrame: Frame = { width, height: height - insets.top - insets.bottom };
  const minSide = Math.min(referenceFrame.width, referenceFrame.height);

  // Escalas
  const baseRem = minSide * 0.042;
  const pad = minSide * 0.04;
  const titleSize = baseRem * 3.0;
  const footSize = baseRem * 0.91;
  const heroSize = minSide * 0.42;
  const cardRadius = minSide * 0.04;
  const segHeight = minSide * 0.09;
  const segPad = minSide * 0.0;
  const pillRadius = minSide * 0.03;
  const footerHeight = minSide * 0.08;

  // Estado UI
  const [, setModalOpen] = useState(false);
  const [apiUrlInput, setApiUrlInput] = useState<string>("");
  const [statusText, setStatusText] = useState<string | null>(null);
  const [me, setMe] = useState<AuthUser | null>(null);
  const [mode, setMode] = useState<Mode>("qr");
  const [isCredsLoading, setIsCredsLoading] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  const contentAreaHeight = mode === "qr" ? minSide * 0.72 : minSide * 0.6;
  const innerPad = pad;
  const scannerMax = Math.max(0, contentAreaHeight - innerPad * 2);
  const qrSize = Math.min(scannerMax, minSide * (mode === "qr" ? 0.38 : 0.3));

  // Credenciales
  const [userField, setUserField] = useState("");
  const [password, setPassword] = useState("");

  // Guards
  const scanBusyRef = useRef(false);
  const loginInFlightRef = useRef(false);
  const syncAbortRef = useRef<AbortController | null>(null);

  // Animations
  const segAnim = useRef(new Animated.Value(0)).current; // 0 = qr izq, 1 = creds der
  const qrOpacity = useRef(new Animated.Value(1)).current;
  const credsOpacity = useRef(new Animated.Value(0)).current;

  // segmented width medido
  const [segWidth, setSegWidth] = useState<number>(0);
  const onSegLayout = (e: LayoutChangeEvent) => {
    const w = e?.nativeEvent?.layout?.width;
    if (typeof w === "number" && isFinite(w) && w > 0) setSegWidth(w);
  };
  const pillWidth = segWidth > 0 ? (segWidth - segPad) / 2 : 0;
  const pillLeft = segAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [segPad, segPad + Math.max(0, pillWidth)],
  });

  const animateMode = useCallback(
    (next: Mode) => {
      const to = next === "qr" ? 0 : 1;
      setMode(next);

      Animated.timing(segAnim, {
        toValue: to,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();

      if (next === "qr") {
        Animated.parallel([
          Animated.timing(qrOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(credsOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.timing(qrOpacity, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(credsOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]).start();
      }
    },
    [segAnim, qrOpacity, credsOpacity]
  );

  useEffect(() => {
    (async () => {
      try {
        const saved = await getApiBase();
        setApiUrlInput(saved || baseUrl || "");
      } catch {}
    })();
  }, [baseUrl]);

  /** ========== helpers para mostrar NoticeBar ========== */
  const showNoticeText = useCallback((kind: NoticeKind, text: string, autoHideMs?: number) => {
    setNotice({ kind, text, autoHideMs });
  }, []);

  const showNoticeKey = useCallback(
    (
      kind: NoticeKind,
      messageKey: string,
      params?: Record<string, string | number>,
      autoHideMs?: number
    ) => {
      setNotice({ kind, messageKey, params, autoHideMs });
    },
    []
  );

  const initialSyncWithStatus = useCallback(async () => {
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
        // Mensaje personalizado usando key
        const mapped = translateApiErrorToNotice("sync", syncErr);
        // Preferimos mantener warning consistente
        showNoticeKey(mapped.kind === "error" ? "warning" : mapped.kind, "sync.failed");
      }
    }
  }, [showNoticeKey]);

  const doLogin = useCallback(
    async (p: QrPayload) => {
      if (loginInFlightRef.current) return;
      loginInFlightRef.current = true;

      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        showNoticeKey("error", "auth.offline_first_login");
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
        if (!accessToken) throw new Error("no_access_token");

        await setTokens(accessToken, refreshToken);

        let u: AuthUser | null = user ?? null;
        if (!u) {
          setStatusText("Cargando perfil…");
          const meResp = await api.get("/auth/me");
          u = meResp.data as AuthUser;
        }
        setMe(u);

        if (autoSync && u) {
          await initialSyncWithStatus();
        }

        setStatusText("¡Listo!");
        requestAnimationFrame(() => router.replace("/"));
      } catch (e: any) {
        // Personalizado: nunca mostramos el mensaje crudo
        if (e?.message === "no_access_token") {
          showNoticeKey("error", "auth.unexpected_no_token");
        } else {
          const { kind, messageKey } = translateApiErrorToNotice("qr", e);
          showNoticeKey(kind, messageKey);
        }
        console.error("[LOGIN][QR] error:", e);
      } finally {
        loginInFlightRef.current = false;
        setTimeout(() => setStatusText(null), 1200);
      }
    },
    [apiUrlInput, baseUrl, endpoint, autoSync, initialSyncWithStatus, router, showNoticeKey]
  );

  // QR: parse + login
  const parseAndLogin = useCallback(
    async (raw: string) => {
      if (scanBusyRef.current) return;
      scanBusyRef.current = true;
      setStatusText("Verificando QR…");
      try {
        const obj = JSON.parse(raw);
        if (!isQrPayload(obj)) throw new Error("qr_payload_invalid");
        await doLogin(obj);
      } catch (e: any) {
        setStatusText(null);
        // Mensaje de QR no válido controlado
        if (e?.message === "qr_payload_invalid") {
          showNoticeKey("error", "qr.invalid");
        } else {
          const { kind, messageKey } = translateApiErrorToNotice("qr", e);
          showNoticeKey(kind, messageKey);
        }
      } finally {
        setModalOpen(false);
        scanBusyRef.current = false;
      }
    },
    [doLogin, showNoticeKey]
  );

  // Credenciales + sync
  useEffect(() => () => syncAbortRef.current?.abort(), []);

  const PrimaryButton: React.FC<{
    title: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
  }> = ({ title, onPress, disabled, loading }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        marginTop: minSide * 0.04,
        paddingVertical: minSide * 0.028,
        borderRadius: minSide * 0.02,
        backgroundColor: disabled || loading ? "#CFCFCF" : colors.primary600,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: minSide * 0.02,
      }}
    >
      {loading && <ActivityIndicator size="small" color="#FFFFFF" />}
      <Text style={{ color: "white", fontWeight: "700", fontSize: minSide * 0.05 }}>
        {loading ? "Ingresando…" : title}
      </Text>
    </Pressable>
  );

  const doCredsLogin = useCallback(async () => {
    if (loginInFlightRef.current || isCredsLoading) return;

    if (!userField.trim() || !password) {
      showNoticeText("warning", "Completa usuario y contraseña.");
      return;
    }

    loginInFlightRef.current = true;
    setIsCredsLoading(true);
    setStatusText("Iniciando sesión…");

    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        showNoticeKey("error", "auth.offline_first_login");
        setStatusText(null);
        return;
      }

      if (apiUrlInput) await setApiBase(apiUrlInput);
      else if (baseUrl) await setApiBase(baseUrl);

      const api = await makeClient();
      const payload: Record<string, string> = { password };
      payload[usernameFieldName] = userField.trim();

      const resp = await api.post(credsEndpoint, payload, {
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      });

      const { access_token: accessToken, refreshToken, user } = resp.data ?? {};
      if (!accessToken) throw new Error("no_access_token");

      await setTokens(accessToken, refreshToken);

      let u: AuthUser | null = user ?? null;
      if (!u) {
        setStatusText("Cargando perfil…");
        const meResp = await api.get("/auth/me");
        u = meResp.data as AuthUser;
      }
      setMe(u);

      if (autoSync && u) {
        await initialSyncWithStatus();
      }

      setStatusText("¡Listo!");
      requestAnimationFrame(() => router.replace("/")); // también puedes usar replace aquí
    } catch (e: any) {
      if (e?.message === "no_access_token") {
        showNoticeKey("error", "auth.unexpected_no_token");
      } else {
        const { kind, messageKey } = translateApiErrorToNotice("creds", e);
        showNoticeKey(kind, messageKey);
      }
      console.error("[LOGIN][CREDS] error:", e);
    } finally {
      loginInFlightRef.current = false;
      setIsCredsLoading(false);
      setTimeout(() => setStatusText(null), 1200);
    }
  }, [
    isCredsLoading,
    userField,
    password,
    apiUrlInput,
    baseUrl,
    credsEndpoint,
    usernameFieldName,
    autoSync,
    initialSyncWithStatus,
    showNoticeKey,
    showNoticeText,
    router,
  ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Overlay superior */}
      <View
        style={{
          position: "absolute",
          height: minSide * 0.45,
          width: "100%",
          top: 0,
          backgroundColor: colors.primary600,
          opacity: 0.18,
        }}
      />

      {/* Footer fijo */}
      <View
        style={{
          position: "absolute",
          left: pad,
          right: pad,
          bottom: insets.bottom + minSide * 0.02,
          height: footerHeight * 1.2,
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <Body
          frame={referenceFrame}
          style={{ textAlign: "center", fontSize: footSize, lineHeight: footSize * 1.2 }}
        >
          © 2019 Compañía Agrícola Industrial Santa Ana, S. A. - All Rights Reserved
        </Body>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: "padding", android: undefined })}
      >
        <View style={{ flex: 1, paddingHorizontal: pad, paddingBottom: footerHeight + pad }}>
          {/* Título */}
          <Body
            frame={referenceFrame}
            weight="bold"
            style={{ fontSize: titleSize, textAlign: "center", marginTop: baseRem * 1.6 }}
          >
            SANTA ANA
          </Body>

          {/* Ilustración */}
          <Image
            source={require("@/../assets/images/qrLogin.png")}
            style={{
              width: heroSize,
              height: heroSize,
              resizeMode: "contain",
              alignSelf: "center",
              marginTop: minSide * 0.02,
              marginBottom: minSide * 0.02,
            }}
          />

          {/* Card */}
          <View
            style={{
              width: "100%",
              alignSelf: "center",
              padding: pad,
              borderRadius: cardRadius,
              backgroundColor: "rgba(255,255,255,1)",
              borderWidth: 1,
              borderColor: "#ECECEC",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.12,
              shadowRadius: 18,
              marginTop: minSide * 0.04,
              elevation: 5,
            }}
          >
            {/* Segmented */}
            <View
              onLayout={onSegLayout}
              style={{
                width: "100%",
                alignSelf: "center",
                borderRadius: pillRadius,
                backgroundColor: "#F2F2F2",
              }}
            >
              <View style={{ height: segHeight, width: "100%", justifyContent: "center" }}>
                {segWidth > 0 && (
                  <Animated.View
                    style={{
                      position: "absolute",
                      left: pillLeft,
                      width: pillWidth,
                      height: segHeight * 1.1,
                      backgroundColor: colors.primary600,
                      borderRadius: pillRadius,
                    }}
                  />
                )}

                <View style={{ flexDirection: "row", height: segHeight, width: "100%" }}>
                  <Pressable
                    onPress={() => animateMode("qr")}
                    style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text
                      style={{
                        fontWeight: "700",
                        fontSize: minSide * 0.04,
                        color: mode === "qr" ? "white" : colors.textPrimary,
                      }}
                    >
                      QR
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => animateMode("creds")}
                    style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text
                      style={{
                        fontWeight: "700",
                        fontSize: minSide * 0.04,
                        color: mode === "creds" ? "white" : colors.textPrimary,
                      }}
                    >
                      Credenciales
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Área estable para QR/Creds */}
            <View
              style={{
                width: "100%",
                height: contentAreaHeight,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Credenciales */}
              <Animated.View
                pointerEvents={mode === "creds" ? "auto" : "none"}
                style={{
                  position: "absolute",
                  top: minSide * 0.028,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  opacity: credsOpacity,
                }}
              >
                <Label
                  text={
                    usernameFieldName === "email"
                      ? "Correo"
                      : usernameFieldName === "nombre_usuario"
                        ? "Usuario"
                        : "Usuario"
                  }
                />
                <Input
                  value={userField}
                  onChangeText={setUserField}
                  placeholder={usernameFieldName === "email" ? "tu@correo.com" : "Usuario"}
                  autoCapitalize="none"
                />
                <View style={{ marginTop: minSide * 0.03 }}>
                  <Label text="Contraseña" />
                  <View style={{ position: "relative" }}>
                    <Input
                      variant="password"
                      value={password}
                      onChangeText={setPassword}
                      renderPasswordToggle={(visible) => (
                        <Ionicons
                          name={visible ? "eye-off" : "eye"}
                          size={20}
                          color={colors.textSecondary}
                        />
                      )}
                    />
                  </View>
                </View>
                <PrimaryButton
                  title="Ingresar"
                  onPress={doCredsLogin}
                  loading={isCredsLoading}
                  disabled={!userField.trim() || !password}
                />
              </Animated.View>

              {/* QR */}
              <Animated.View
                pointerEvents={mode === "qr" ? "auto" : "none"}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  opacity: qrOpacity,
                }}
              >
                <QrIntroSection
                  referenceFrame={referenceFrame}
                  title="Ingreso con QR"
                  subtitle="Toca para escanear"
                  scannerSize={qrSize}
                  user={me}
                  statusText={statusText}
                  setStatusText={setStatusText}
                  onQr={parseAndLogin}
                  containerStyle={{ marginTop: 0, paddingHorizontal: 0 }}
                />
              </Animated.View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Banner inferior */}
      {notice ? (
        <NoticeBar
          kind={notice.kind}
          // Preferimos usar messageKey/params; text queda como fallback/legacy
          messageKey={notice.messageKey as any}
          params={notice.params}
          text={notice.text}
          placement="top"
          topInsetPx={insets.top + minSide * 0.02}
          autoHideMs={notice.autoHideMs ?? (notice.kind === "success" ? 2200 : undefined)}
          onClose={() => setNotice(null)}
        />
      ) : null}
    </SafeAreaView>
  );
};

export default QrLoginOnboarding;
