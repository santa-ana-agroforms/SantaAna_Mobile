// screens/QrLoginOnboarding.tsx
import { getApiBase, makeClient, setApiBase, setTokens } from "@/api/client";
import QrScannerButton from "@/components/atoms/QrScannerButton";
import { Body } from "@/components/atoms/Typography";
import ScannerModal from "@/components/qr/ScannerModal";
import { DB } from "@/db/sqlite";
import { useResponsive } from "@/hooks/useResponsive";
import { pullUserAndForms } from "@/sync/pull";
import { colors } from "@/theme/tokens";
import type { AuthUser } from "@/types";
import NetInfo from "@react-native-community/netinfo";
import React, { useCallback, useMemo, useState } from "react";
import { Alert, Image, Platform, StyleSheet, View } from "react-native";
import type { QrPayload } from "../auth/qrTypes";
import { isQrPayload } from "../auth/qrTypes";

type FormTree = { id_formulario: string; nombre: string; };

type Props = {
  endpoint?: string;         // default /auth/qr/login
  baseUrl?: string;
  autoSync?: boolean;        // default true
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
  const [forms, setForms] = useState<FormTree[]>([]);
  const [loadingForms, setLoadingForms] = useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const saved = await getApiBase();
        setApiUrlInput(saved || baseUrl || "");
      } catch { /* ignore */ }
    })();
  }, [baseUrl]);

  const parseAndLogin = useCallback(async (raw: string) => {
    setStatusText("Verificando QR…");
    try {
      const obj = JSON.parse(raw);
      if (!isQrPayload(obj)) throw new Error("El QR no contiene {sid, nonce, sig}.");
      await doLogin(obj);
    } catch (e: any) {
      setStatusText(null);
      Alert.alert("QR inválido", e?.message ?? "El QR escaneado no es JSON.");
    } finally {
      // cerramos modal al terminar la verificación/sync
      setModalOpen(false);
    }
  }, []);

  const doLogin = useCallback(async (p: QrPayload) => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      Alert.alert("Sin conexión", "Se requiere internet para el primer login.");
      setStatusText(null);
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
        await DB.ensureMigrated();
        await pullUserAndForms(u);
      }
      setStatusText("¡Listo!");
      onSuccess?.(u!);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "No se pudo completar el login por QR.";
      Alert.alert("Error de login", msg);
    } finally {
      setTimeout(() => setStatusText(null), 1200);
    }
  }, [apiUrlInput, baseUrl, endpoint, autoSync, onSuccess]);

  const saveApiUrl = useCallback(async () => {
    if (!apiUrlInput?.trim()) {
      Alert.alert("Base URL", "Ingresa una URL válida.");
      return;
    }
    await setApiBase(apiUrlInput.trim());
    Alert.alert("Base URL", "Guardada.");
  }, [apiUrlInput]);

  const loadForms = useCallback(async () => {
    setLoadingForms(true);
    try {
      const api = await makeClient();
      const { data } = await api.get<FormTree[]>("/forms/tree");
      setForms(data ?? []);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "No se pudieron cargar los formularios.";
      Alert.alert("Error", msg);
    } finally {
      setLoadingForms(false);
    }
  }, []);

  const codeFont = useMemo(
    () => (Platform.select({ ios: "Menlo", android: "monospace" }) as any),
    []
  );

  return (
    <View style={[styles.container, { padding: scale(16) }]}>
      {/* Header simple tipo mockup */}
      <Body weight="bold" style={{ fontSize: rem * 3, textAlign: "center", marginTop: rem * 3 }}>
        SANTA ANA APP
      </Body>

      <Image
        source={require("@/../assets/images/qrLogin.png")}
        style={{
          width: rem * 19,  
          height: rem * 19,
          resizeMode: "contain",
          alignSelf: "center",
          marginVertical: rem * 4
        }}
      />

      <Body weight="bold" style={{ fontSize: rem * 2.5, textAlign: "center" }}>
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
          <Body weight="bold" style={{ marginBottom: 6 }}>Usuario</Body>
          <Body>Nombre: <Body selectable weight="bold">{me.nombre}</Body></Body>
          <Body>Usuario: <Body selectable weight="bold">{me.nombre_de_usuario}</Body></Body>
          {!!me.roles?.length && (
            <>
              <Body style={{ opacity: 0.7, marginTop: 6 }}>Roles</Body>
              {me.roles.map(r => (<Body key={r.id}>• {r.nombre} (id: {r.id})</Body>))}
            </>
          )}
        </View>
      )}

      <View style={{ marginBottom: rem * 2, position: "absolute", bottom: 0, left: 0, right: 0, marginHorizontal: rem * 2.5, alignItems: "center" }}>
        <Body style={{ textAlign: "center", fontSize: rem * 1.6 }}>
          © 2019 Compañía Agrícola Industrial Santa Ana, S. A. - All Rights Reserved
        </Body>
      </View>

      {/* Mini input Base URL + cargar formularios
      <View style={[styles.card, { borderColor: colors.border, marginTop: 12 }]}>
        <Body weight="bold" style={{ marginBottom: 8 }}>API base URL</Body>
        <TextInput
          value={apiUrlInput}
          onChangeText={setApiUrlInput}
          placeholder="http://192.168.x.x:3000"
          autoCapitalize="none"
          style={{
            borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginBottom: 8,
            fontFamily: codeFont,
          }}
        />
        <Button title="Guardar URL" onPress={saveApiUrl} />
        <View style={{ height: 8 }} />
        <Button title="Cargar formularios (/forms/tree)" onPress={loadForms} variant="primary" />

        {loadingForms ? (
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
            <ActivityIndicator /><Body style={{ marginLeft: 8 }}>Cargando…</Body>
          </View>
        ) : null}

        {!!forms.length && (
          <View style={{ marginTop: 12 }}>
            <Body weight="bold">Formularios ({forms.length})</Body>
            <FlatList
              style={{ marginTop: 6, maxHeight: 200 }}
              data={forms}
              keyExtractor={(it) => it.id_formulario}
              renderItem={({ item }) => (<Body selectable>• {item.nombre} — {item.id_formulario}</Body>)}
            />
          </View>
        )}
      </View> */}

      {/* Modal Scanner */}
      <ScannerModal
        visible={modalOpen}
        onClose={() => { setModalOpen(false); setStatusText(null); }}
        onQr={parseAndLogin}
        statusText={statusText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: "100%" },
  card: {
    marginTop: 16, width: "100%", borderRadius: 12, borderWidth: 1, padding: 14,
    backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
});
