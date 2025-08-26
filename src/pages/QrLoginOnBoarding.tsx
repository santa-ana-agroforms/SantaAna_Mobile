// screens/QrLoginOnboarding.tsx
import { getApiBase, makeClient, setApiBase, setTokens } from "@/api/client";
import QrScannerButton from "@/components/atoms/QrScannerButton";
import { Body } from "@/components/atoms/Typography";
import ScannerModal from "@/components/qr/ScannerModal";
import { useResponsive } from "@/hooks/useResponsive";
import { colors } from "@/theme/tokens";
import type { AuthUser } from "@/types";
import NetInfo from "@react-native-community/netinfo";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, Image, Platform, StyleSheet, View } from "react-native";
import type { QrPayload } from "../auth/qrTypes";
import { isQrPayload } from "../auth/qrTypes";

// ⬇️ Usa tus helpers nuevos (NO pullUserAndForms)
import { fetchAndSaveForms } from "@/api/forms";

type Props = {
  endpoint?: string; // default /auth/qr/login
  baseUrl?: string;
  autoSync?: boolean; // default true
  onSuccess?: (user: AuthUser) => void;
};

export default function QrLoginOnboarding({
  endpoint = "/auth/qr/login",
  baseUrl,
  autoSync = true,
  onSuccess,
}: Props) {
  const { rem, scale } = useResponsive();
  const [modalOpen, setModalOpen] = useState(false);
  const [apiUrlInput, setApiUrlInput] = useState<string>("");
  const [statusText, setStatusText] = useState<string | null>(null);
  const [me, setMe] = useState<AuthUser | null>(null);

  // ---- Guards / refs para evitar dobles disparos
  const scanBusyRef = useRef(false); // evita doble parse del QR
  const loginInFlightRef = useRef(false); // evita doble login
  const syncAbortRef = useRef<AbortController | null>(null);

  // Cargar base URL guardada
  useEffect(() => {
    (async () => {
      try {
        const saved = await getApiBase();
        setApiUrlInput(saved || baseUrl || "");
      } catch {
        /* ignore */
      }
    })();
  }, [baseUrl]);

  // ---- Parseo del QR y arranque de login (con guard)
  const parseAndLogin = useCallback(async (raw: string) => {
    if (scanBusyRef.current) return;
    scanBusyRef.current = true;

    setStatusText("Verificando QR…");
    try {
      const obj = JSON.parse(raw);
      if (!isQrPayload(obj))
        throw new Error("El QR no contiene {sid, nonce, sig}.");
      await doLogin(obj);
    } catch (e: any) {
      setStatusText(null);
      Alert.alert("QR inválido", e?.message ?? "El QR escaneado no es JSON.");
    } finally {
      // Cerrar modal sólo cuando finaliza login/sync
      setModalOpen(false);
      // liberar el guard del escáner
      scanBusyRef.current = false;
    }
  }, []);

  // ---- Login + Sync (usando fetchAndSaveForms)
  const doLogin = useCallback(
    async (p: QrPayload) => {
      if (loginInFlightRef.current) return;
      loginInFlightRef.current = true;

      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        Alert.alert(
          "Sin conexión",
          "Se requiere internet para el primer login."
        );
        setStatusText(null);
        loginInFlightRef.current = false;
        return;
      }

      try {
        if (apiUrlInput) await setApiBase(apiUrlInput);
        else if (baseUrl) await setApiBase(baseUrl);

        const api = await makeClient();
        const resp = await api.post(endpoint, {
          sid: p.sid,
          nonce: p.nonce,
          sig: p.sig,
        });

        const {
          access_token: accessToken,
          refreshToken,
          user,
        } = resp.data ?? {};
        if (!accessToken)
          throw new Error("No se recibió accessToken del servidor.");

        await setTokens(accessToken, refreshToken);

        let u: AuthUser | null = user ?? null;
        if (!u) {
          setStatusText("Cargando perfil…");
          const meResp = await api.get("/auth/me");
          u = meResp.data as AuthUser;
        }
        setMe(u);

        // ---- SINCRONIZACIÓN de formularios (usa tus helpers)
        if (autoSync && u) {
          setStatusText("Sincronizando formularios…");

          // Cancela sync previa si existía
          syncAbortRef.current?.abort();
          const controller = new AbortController();
          syncAbortRef.current = controller;

          try {
            // fetchAndSaveForms llama a /forms/tree y guarda en SQLite
            await fetchAndSaveForms(
              // opcional: puente a statusText como "loading"
              (v) =>
                setStatusText(v ? "Sincronizando formularios…" : "¡Listo!"),
              controller.signal
            );
          } catch (syncErr: any) {
            if (controller.signal.aborted) {
              // cancelado al desmontar, salimos silencioso
            } else {
              console.warn("[SYNC] fallo en fetchAndSaveForms:", syncErr);
              Alert.alert(
                "Advertencia",
                "El inicio de sesión fue correcto, pero falló la sincronización inicial. Podrás sincronizar más tarde desde el Home."
              );
            }
          }
        }

        setStatusText("¡Listo!");
        onSuccess?.(u!); // navegar al Home
      } catch (e: any) {
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          "No se pudo completar el login por QR.";
        Alert.alert("Error de login", msg);
        console.error("[LOGIN] error:", e);
      } finally {
        // liberar guard para permitir un nuevo intento si hace falta
        loginInFlightRef.current = false;
        // limpiar status después de un ratito
        setTimeout(() => setStatusText(null), 1200);
      }
    },
    [apiUrlInput, baseUrl, endpoint, autoSync, onSuccess]
  );

  // Cancelar sync si se desmonta
  useEffect(() => {
    return () => syncAbortRef.current?.abort();
  }, []);

  const codeFont = useMemo(
    () => Platform.select({ ios: "Menlo", android: "monospace" }) as any,
    []
  );

  // ---- UI
  return (
    <View style={[styles.container, { padding: scale(16) }]}>
      <Body
        weight="bold"
        style={{ fontSize: rem * 3, textAlign: "center", marginTop: rem * 3 }}
      >
        SANTA ANA APP
      </Body>

      <Image
        source={require("@/../assets/images/qrLogin.png")}
        style={{
          width: rem * 2,
          height: rem * 2,
          resizeMode: "contain",
          alignSelf: "center",
          marginVertical: rem * 4,
        }}
      />

      <Body weight="bold" style={{ fontSize: rem * 1, textAlign: "center" }}>
        Bienvenido
      </Body>
      <Body style={{ opacity: 0.8, textAlign: "center", marginTop: rem * 0.6 }}>
        Escanea tu código QR
      </Body>

      <View style={{ height: 16 }} />

      <View style={{ marginTop: rem * 2, alignItems: "center" }}>
        <QrScannerButton size={rem * 20} onPress={() => setModalOpen(true)} />
      </View>

      {/* Estado usuario (si ya está) */}
      {me && (
        <View style={[styles.card, { borderColor: colors.border }]}>
          <Body weight="bold" style={{ marginBottom: 6 }}>
            Usuario
          </Body>
          <Body>
            Nombre:{" "}
            <Body selectable weight="bold">
              {me.nombre}
            </Body>
          </Body>
          <Body>
            Usuario:{" "}
            <Body selectable weight="bold">
              {me.nombre_de_usuario}
            </Body>
          </Body>
          {!!me.roles?.length && (
            <>
              <Body style={{ opacity: 0.7, marginTop: 6 }}>Roles</Body>
              {me.roles.map((r) => (
                <Body key={r.id}>
                  • {r.nombre} (id: {r.id})
                </Body>
              ))}
            </>
          )}
        </View>
      )}

      <View
        style={{
          marginBottom: rem * 2,
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          marginHorizontal: rem * 2.5,
          alignItems: "center",
        }}
      >
        <Body style={{ textAlign: "center", fontSize: rem * 1.6 }}>
          © 2019 Compañía Agrícola Industrial Santa Ana, S. A. - All Rights
          Reserved
        </Body>
      </View>

      {/* Modal del escáner (muestra statusText durante login/sync) */}
      <ScannerModal
        visible={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setStatusText(null);
        }}
        onQr={parseAndLogin}
        statusText={statusText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: "100%" },
  card: {
    marginTop: 16,
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
});
