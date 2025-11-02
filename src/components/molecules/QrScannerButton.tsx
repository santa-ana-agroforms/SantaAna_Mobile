// QrLoginScanner.tsx (login SOLO por QR con {sid, nonce, sig} + user + mini input de forms)
import Button from "@/components/atoms/Button";
import { Body } from "@/components/atoms/Typography";
import { useResponsive } from "@/hooks/useResponsive";
import { colors } from "@/theme/tokens";
import NetInfo from "@react-native-community/netinfo";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { getApiBase, makeClient, setApiBase, setTokens } from "@/api/client";
import { DB } from "@/db/sqlite";
import { pullUserAndForms } from "@/sync/pull";
import type { AuthUser } from "@/types";

type QrPayload = { sid: string; nonce: string; sig: string };
const isQrPayload = (x: unknown): x is QrPayload =>
  !!x &&
  typeof x === "object" &&
  "sid" in x &&
  typeof (x as any).sid === "string" &&
  "nonce" in x &&
  typeof (x as any).nonce === "string" &&
  "sig" in x &&
  typeof (x as any).sig === "string";

type Props = {
  baseUrl?: string;
  endpoint?: string; // default: /auth/qr/login
  autoSync?: boolean; // default: true
  onSuccess?: (user: AuthUser) => void;
  onClose?: () => void;
};

type FormTree = {
  id_formulario: string;
  nombre: string;
};

const QrLoginScanner: React.FC<Props> = ({
  baseUrl,
  endpoint = "/auth/qr/login",
  autoSync = true,
  onSuccess,
  onClose,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isOpen, setIsOpen] = useState(false);
  const [scannedOnce, setScannedOnce] = useState(false);

  const [parsed, setParsed] = useState<QrPayload | null>(null);
  const [raw, setRaw] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [me, setMe] = useState<AuthUser | null>(null);
  const [apiUrlInput, setApiUrlInput] = useState<string>(baseUrl ?? "");
  const [forms, setForms] = useState<FormTree[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);

  const { rem, scale } = useResponsive();

  // Cargar la base URL ya guardada (si existe) para mostrarla en el input
  useEffect(() => {
    (async () => {
      try {
        const saved = await getApiBase();
        setApiUrlInput(saved);
      } catch {
        // no configurada todavía
      }
    })();
  }, []);

  const handleOpen = useCallback(async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) return;
    }
    setParsed(null);
    setRaw(null);
    setScannedOnce(false);
    setStatusMsg(null);
    setIsOpen(true);
  }, [permission?.granted, requestPermission]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const doLogin = useCallback(
    async (p: QrPayload) => {
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        Alert.alert("Sin conexión", "Se requiere internet para el primer login.");
        return;
      }
      setLoading(true);
      setStatusMsg("Verificando QR…");
      try {
        if (baseUrl) await setApiBase(baseUrl);
        const api = await makeClient();

        // Esperamos: { access_token, refreshToken?, user? }
        const resp = await api.post(endpoint, {
          sid: p.sid,
          nonce: p.nonce,
          sig: p.sig,
        });
        const { access_token: accessToken, refreshToken, user } = resp.data ?? {};
        if (!accessToken) throw new Error("No se recibió accessToken del servidor.");

        await setTokens(accessToken, refreshToken);

        let u: AuthUser | null = user ?? null;
        if (!u) {
          setStatusMsg("Cargando perfil…");
          const meResp = await api.get("/auth/me");
          u = meResp.data as AuthUser;
        }
        setMe(u);

        if (autoSync && u) {
          setStatusMsg("Sincronizando formularios…");
          await DB.ensureMigrated();
          await pullUserAndForms(u);
        }

        setStatusMsg("¡Listo!");
        onSuccess?.(u!);
      } catch (e: any) {
        const msg =
          e?.response?.data?.message || e?.message || "No se pudo completar el login por QR.";
        Alert.alert("Error de login", msg);
        console.log(msg);
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, endpoint, autoSync, onSuccess]
  );

  const handleBarCodeScanned = useCallback(
    (ev: BarcodeScanningResult) => {
      if (scannedOnce) return;
      setScannedOnce(true);

      const data = ev.data ?? "";
      try {
        const obj = JSON.parse(data);
        if (isQrPayload(obj)) {
          setParsed(obj);
          setIsOpen(false);
          void doLogin(obj);
        } else {
          setRaw(data);
          setIsOpen(false);
          Alert.alert("QR inválido", "El QR no contiene {sid, nonce, sig}.");
        }
      } catch {
        setRaw(data);
        setIsOpen(false);
        Alert.alert("QR inválido", "El QR escaneado no es JSON.");
      }
    },
    [scannedOnce, doLogin]
  );

  const prettyJson = useMemo(
    () => (parsed ? JSON.stringify(parsed, null, 2) : (raw ?? "")),
    [parsed, raw]
  );

  // Guardar la base URL desde el input
  const saveApiUrl = useCallback(async () => {
    if (!apiUrlInput?.trim()) {
      Alert.alert("Base URL", "Ingresa una URL válida.");
      return;
    }
    await setApiBase(apiUrlInput.trim());
    Alert.alert("Base URL", "Guardada.");
  }, [apiUrlInput]);

  // Cargar formularios de /forms/tree y mostrarlos
  const loadForms = useCallback(async () => {
    setFormsLoading(true);
    try {
      const api = await makeClient();
      const { data } = await api.get<FormTree[]>("/forms/tree");
      console.log(data);
      setForms(data ?? []);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message || e?.message || "No se pudieron cargar los formularios.";
      Alert.alert("Error", msg);
    } finally {
      setFormsLoading(false);
    }
  }, []);

  return (
    <View style={[styles.container, { padding: scale(16) }]}>
      {!isOpen && (
        <>
          <Button
            title="Escanear QR para iniciar sesión"
            onPress={handleOpen}
            variant="primary"
            size="lg"
          />

          {(parsed || raw || loading || statusMsg || me) && (
            <View style={[styles.card, { borderColor: colors.border }]}>
              <Body
                weight="bold"
                style={{
                  fontSize: rem * 1.6,
                  marginBottom: 6,
                  color: colors.textPrimary,
                }}
              >
                Estado
              </Body>

              {loading ? (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <ActivityIndicator />
                  <Body style={{ marginLeft: 8 }}>{statusMsg ?? "Procesando…"}</Body>
                </View>
              ) : parsed ? (
                <>
                  <KeyValue label="sid" value={parsed.sid} />
                  <KeyValue label="nonce" value={parsed.nonce} />
                  <KeyValue label="sig" value={parsed.sig} />
                </>
              ) : raw && !statusMsg ? (
                <View style={styles.codeBlock}>
                  <Text
                    allowFontScaling={false}
                    selectable
                    style={[styles.codeText, { fontSize: rem * 1.25, color: colors.textPrimary }]}
                  >
                    {prettyJson}
                  </Text>
                </View>
              ) : null}

              {/* Datos del usuario autenticado */}
              {me && (
                <View style={{ marginTop: 12 }}>
                  <Body weight="bold" style={{ marginBottom: 6 }}>
                    Usuario
                  </Body>
                  <KeyValue label="Nombre" value={me.nombre} />
                  <KeyValue label="Usuario" value={me.nombre_de_usuario} />
                  <Body style={{ opacity: 0.7, marginTop: 6 }}>Roles</Body>
                  {me.roles?.map((r) => (
                    <Body key={r.id} selectable>
                      • {r.nombre} (id: {r.id})
                    </Body>
                  ))}
                </View>
              )}

              <View style={{ height: 12 }} />
              <Button title="Reintentar" onPress={handleOpen} variant="ghost" />
              <View style={{ height: 8 }} />
              <Button title="Cerrar" onPress={handleClose} variant="ghost" />
            </View>
          )}

          {/* MINI INPUT para configurar la base URL y cargar formularios */}
          <View style={[styles.card, { borderColor: colors.border, marginTop: 12 }]}>
            <Body weight="bold" style={{ marginBottom: 8 }}>
              API base URL
            </Body>
            <TextInput
              allowFontScaling={false}
              value={apiUrlInput}
              onChangeText={setApiUrlInput}
              placeholder="http://192.168.x.x:3000"
              autoCapitalize="none"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 10,
                marginBottom: 8,
              }}
            />
            <Button title="Guardar URL" onPress={saveApiUrl} />
            <View style={{ height: 8 }} />
            <Button
              title="Cargar formularios (/forms/tree)"
              onPress={loadForms}
              variant="primary"
            />
            {formsLoading && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 8,
                }}
              >
                <ActivityIndicator />
                <Body style={{ marginLeft: 8 }}>Cargando…</Body>
              </View>
            )}
            {!!forms.length && (
              <View style={{ marginTop: 12 }}>
                <Body weight="bold">Formularios ({forms.length})</Body>
                <FlatList
                  style={{ marginTop: 6 }}
                  data={forms}
                  keyExtractor={(it) => it.id_formulario}
                  renderItem={({ item }) => (
                    <Body selectable>
                      • {item.nombre} — {item.id_formulario}
                    </Body>
                  )}
                />
              </View>
            )}
          </View>
        </>
      )}

      {isOpen && (
        <View style={styles.cameraWrap}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarCodeScanned}
          >
            <View style={styles.overlayTop} />
            <View style={styles.overlayMiddle}>
              <View style={styles.overlaySide} />
              <View style={[styles.focusBox, { borderColor: colors.primary600 }]} />
              <View style={styles.overlaySide} />
            </View>
            <View style={styles.overlayBottom}>
              <Body color="inverse" style={{ opacity: 0.95 }}>
                Apuntá al código QR
              </Body>
              <View style={{ height: 8 }} />
              <Button title="Cerrar" onPress={handleClose} variant="ghost" />
            </View>
          </CameraView>
        </View>
      )}

      {permission && !permission.granted && !isOpen && (
        <Body style={{ marginTop: 12, color: colors.textSecondary }}>
          Necesitamos permiso de cámara para escanear el QR.
        </Body>
      )}
    </View>
  );
};

export default QrLoginScanner;

const KeyValue = ({ label, value }: { label: string; value: string }) => (
  <View style={{ marginBottom: 8 }}>
    <Body style={{ opacity: 0.7 }}>{label}</Body>
    <Body selectable weight="bold">
      {value}
    </Body>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    width: "100%",
  },
  card: {
    marginTop: 16,
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  codeBlock: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  codeText: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }) as any,
  },
  cameraWrap: {
    width: "100%",
    height: 440,
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 12,
  },
  camera: { flex: 1 },
  overlayTop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  overlayMiddle: { height: 240, flexDirection: "row" },
  overlaySide: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  focusBox: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 12,
  },
});
