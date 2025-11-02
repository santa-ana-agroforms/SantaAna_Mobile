// app/form/saved/index.tsx
import { sendFormEntry } from "@/api/client";
import PageScaffold from "@/components/templates/PageScaffold";
import { type FilledState, type FormJSON, getEntryById, markSynced } from "@/db/form-entries";
import { keyOf, validators } from "@/forms/runtime/field-registry";
import { useFormPersistence } from "@/forms/state/useFormPersistence";
import { isOnline } from "@/utils/network";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ───────────────── helpers ─────────────────
const pageKey = (p: FormJSON["paginas"][number], idx: number) =>
  (p as any).id_pagina || `pagina_${(p as any).secuencia ?? (p as any).sequence ?? idx + 1}`;

const isPlainObject = (v: any) => v && typeof v === "object" && !Array.isArray(v);
const rowIsEmptyGeneric = (row: any) => {
  if (!isPlainObject(row)) return true;
  for (const k of Object.keys(row)) {
    if (k === "__id") continue;
    const v = row[k];
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (isPlainObject(v) && Object.keys(v).length === 0) continue;
    return false;
  }
  return true;
};

// ✅ Valida requeridos (soporta grupos por id_grupo, por clase o por valor arreglo)
const validateWholeFormRequired = (form: FormJSON, filled: FilledState) => {
  const errors: Record<string, string[]> = {};
  let missing = 0;

  form.paginas.forEach((p, idx) => {
    const pk = pageKey(p, idx);

    p.campos.forEach((c: any) => {
      if (!c.requerido) return;

      const clase = String(c.clase || "").toLowerCase();
      const val = (filled as any)?.[pk]?.[c.nombre_interno];
      const k = keyOf(c.tipo, c.clase);

      // 🔎 grupo si: tiene id_grupo o clase=group o el valor es Array
      const isGroup = !!c?.config?.id_grupo || clase === "group" || Array.isArray(val);

      if (isGroup) {
        const rows = val;
        const nFilled = Array.isArray(rows)
          ? rows.filter((r: any) => !rowIsEmptyGeneric(r)).length
          : 0;
        if (nFilled < 1) {
          errors[`${pk}.${c.nombre_interno}`] = ["Al menos una fila requerida."];
          missing += 1;
        }
        return;
      }

      if (!k) return; // tipo/clase no registrado: lo ignoramos

      const errs = validators[k](val, true, c.config);
      if (errs.length) {
        errors[`${pk}.${c.nombre_interno}`] = errs;
        missing += 1;
      }
    });
  });

  return { ok: missing === 0, missing, errors };
};

// mock de envío (tu endpoint real va aquí

// ─────────────── pantalla ───────────────
type FilterMode = "pending" | "synced";

const SavedEntriesScreen = () => {
  const router = useRouter();
  const { entriesSummary, refreshSummary, loading } = useFormPersistence();

  const [completeMap, setCompleteMap] = useState<
    Record<string, { ok: boolean; missing: number; status?: string }>
  >({});
  const [sendingId, setSendingId] = useState<string | null>(null);

  // 🔀 filtro: por defecto solo pendientes
  const [filterMode, setFilterMode] = useState<FilterMode>("pending");

  // Auto-refresh al volver a enfocar esta pantalla
  useFocusEffect(
    useCallback(() => {
      refreshSummary().catch(() => {});
    }, [refreshSummary])
  );

  // Recalcular “completo?” en paralelo cada vez que cambia el summary
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const savedList = await Promise.all(entriesSummary.map((it) => getEntryById(it.local_id)));
      const acc: Record<string, { ok: boolean; missing: number; status?: string }> = {};
      for (const saved of savedList) {
        if (!saved) continue;
        const { ok, missing } = validateWholeFormRequired(
          saved.form_json as FormJSON,
          saved.fill_json as FilledState
        );
        acc[saved.local_id] = { ok, missing, status: saved.status };
      }
      if (!cancelled) setCompleteMap(acc);
    })();
    return () => {
      cancelled = true;
    };
  }, [entriesSummary]);

  const openOne = useCallback(
    async (local_id: string) => {
      const saved = await getEntryById(local_id);
      if (!saved) {
        Alert.alert("Ups", "No se encontró el registro.");
        return;
      }
      router.push({
        pathname: "/form/[formId]",
        params: { formId: saved.form_id, restored: local_id },
      });
    },
    [router]
  );

  const sendOne = useCallback(
    async (local_id: string) => {
      const ctrl = new AbortController(); // por si querés abortar el envío al salir de la pantalla
      try {
        setSendingId(local_id);

        const saved = await getEntryById(local_id);
        if (!saved) {
          Alert.alert("Ups", "No se encontró el registro.");
          return;
        }

        // 1) validación de requeridos (ya la tenés)
        const v = validateWholeFormRequired(
          saved.form_json as FormJSON,
          saved.fill_json as FilledState
        );
        if (!v.ok) {
          Alert.alert("Formulario incompleto", `Faltan ${v.missing} campo(s) requerido(s).`);
          return;
        }

        // 2) red (evita pegarle al server si estás offline)
        if (!(await isOnline())) {
          Alert.alert("Sin conexión", "Conéctate a Internet para enviar el formulario.");
          return;
        }

        // 3) envío real
        const resp = await sendFormEntry(saved, { signal: ctrl.signal });
        console.log("[entries] server response:", resp);

        // 4) marcá como 'synced' localmente
        await markSynced(local_id);
        setCompleteMap((prev) => ({
          ...prev,
          [local_id]: { ...(prev[local_id] ?? { ok: true, missing: 0 }), status: "synced" },
        }));
        await refreshSummary();

        Alert.alert("Enviado", "El formulario se envió y se marcó como 'synced'.");
      } catch (e: any) {
        // si usás AbortController: e?.name === 'CanceledError' o 'AbortError'
        Alert.alert("Error", e?.message ?? "No se pudo enviar el formulario.");
      } finally {
        setSendingId(null);
      }
    },
    [refreshSummary]
  );

  // Lista filtrada:
  const filteredSummary = useMemo(() => {
    return entriesSummary.filter((it) => {
      const st = completeMap[it.local_id]?.status;
      if (filterMode === "synced") return st === "synced"; // ✅ solo enviados
      return st !== "synced"; // ✅ solo pendientes
    });
  }, [entriesSummary, completeMap, filterMode]);

  const doRefresh = useCallback(() => {
    refreshSummary().catch(() => {});
  }, [refreshSummary]);

  return (
    <PageScaffold title="Borradores" variant="groups">
      {/* acciones */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}>
        {/* conmutador Pendientes / Enviados */}
        <View
          style={{
            flexDirection: "row",
            alignSelf: "center",
            backgroundColor: "#F2F2F2",
            borderRadius: 999,
            padding: 4,
            gap: 4,
          }}
        >
          {(["pending", "synced"] as FilterMode[]).map((mode) => {
            const active = filterMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                onPress={() => setFilterMode(mode)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: active ? "#0A84FF" : "transparent",
                }}
              >
                <Text
                  allowFontScaling={false}
                  style={{ color: active ? "white" : "#333", fontWeight: "700" }}
                >
                  {mode === "pending" ? "Pendientes" : "Enviados"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Recargar */}
        <View style={{ alignItems: "flex-end" }}>
          <TouchableOpacity
            onPress={doRefresh}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: "#EFEFEF",
            }}
          >
            <Text allowFontScaling={false} style={{ fontWeight: "700" }}>
              {loading ? "Actualizando…" : "Recargar"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredSummary}
        keyExtractor={(it) => it.local_id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshSummary} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
        renderItem={({ item }) => {
          const meta = completeMap[item.local_id];
          const isComplete = !!meta?.ok;
          const isSynced = meta?.status === "synced";
          const disabledSend = !isComplete || isSynced;

          return (
            <View
              style={{
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#E6E6E6",
                backgroundColor: "white",
                gap: 8,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text allowFontScaling={false} style={{ fontWeight: "700" }}>
                    {item.form_name}
                  </Text>
                  <View style={{ height: 4 }} />
                  <Text allowFontScaling={false} style={{ color: "#555" }}>
                    Versión: {item.index_version_id}
                  </Text>
                  <Text allowFontScaling={false} style={{ color: "#777" }}>
                    Guardado: {item.filled_at_local}
                  </Text>
                  <View style={{ height: 6 }} />
                  {meta ? (
                    isComplete ? (
                      <Text
                        allowFontScaling={false}
                        style={{ color: "#2e7d32", fontWeight: "600" }}
                      >
                        ✔ Completo
                      </Text>
                    ) : (
                      <Text
                        allowFontScaling={false}
                        style={{ color: "#d32f2f", fontWeight: "600" }}
                      >
                        ✖ Incompleto · faltan {meta.missing}
                      </Text>
                    )
                  ) : (
                    <Text allowFontScaling={false} style={{ color: "#999" }}>
                      Verificando…
                    </Text>
                  )}
                  {isSynced ? (
                    <Text
                      allowFontScaling={false}
                      style={{ marginTop: 2, color: "#0066cc", fontWeight: "600" }}
                    >
                      Estado: synced
                    </Text>
                  ) : null}
                </View>

                <View style={{ gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => openOne(item.local_id)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: "#F2F2F2",
                      alignItems: "center",
                    }}
                  >
                    <Text allowFontScaling={false} style={{ fontWeight: "700" }}>
                      Abrir
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={disabledSend || sendingId === item.local_id}
                    onPress={() => sendOne(item.local_id)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: disabledSend ? "#C8E6C9" : "#2E7D32",
                      opacity: sendingId === item.local_id ? 0.8 : 1,
                      alignItems: "center",
                    }}
                  >
                    {sendingId === item.local_id ? (
                      <ActivityIndicator />
                    ) : (
                      <Text allowFontScaling={false} style={{ color: "white", fontWeight: "700" }}>
                        {isSynced ? "Enviado" : isComplete ? "Enviar" : "Completar"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={{ padding: 16 }}>
            <Text allowFontScaling={false} style={{ color: "#666" }}>
              {filterMode === "synced" ? "No hay historial aún." : "No hay borradores pendientes."}
            </Text>
          </View>
        }
      />
    </PageScaffold>
  );
};

export default SavedEntriesScreen;
