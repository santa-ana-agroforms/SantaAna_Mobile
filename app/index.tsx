import { clearTokens } from "@/api/client";
import { syncAllDatasets } from "@/api/datasets";
import { fetchAndSaveForms } from "@/api/forms";
import type { FormCategoryGroup } from "@/api/forms/types";
import { pullAndCacheGroups } from "@/api/groups";
import {
  ensureDailyMaintenanceRegistered,
  runMidnightCatchUpIfNeeded,
} from "@/background/dailyMaintenance";

import Button from "@/components/atoms/Button";
import SkeletonLoader from "@/components/atoms/SkeletonLoader";
import CategoryCard from "@/components/molecules/CategoryCard";
import PageScaffold from "@/components/templates/PageScaffold";
import { findReadyToSubmitReminder } from "@/db/form-entries";
import { DB, planAvailabilityNotifications, tryMarkNotificationSent } from "@/db/sqlite";
import { cancelAllNotifications, notifyNow, scheduleTodayAt } from "@/notifications";
import { onActiveWithInternet } from "@/utils/appstate";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

// Imports de Red y Utils
import { getLastUpdatedDate, setLastUpdatedNow } from "@/utils/lastUpdated"; // ⬅️ Importante
import NetInfo from "@react-native-community/netinfo";

// ✅ Reusar decorators
import {
  ensureDailyCleanupNowIfNeeded,
  MIDNIGHT_CLEAN_TASK,
  registerMidnightCleanup,
  unregisterMidnightCleanup,
} from "@/background/midnight-cleanup";

import { useInstanceSelectorState } from "@/forms/state/useInstanceSelectorState";
import * as TaskManager from "expo-task-manager";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const Home: React.FC = () => {
  const [data, setData] = useState<FormCategoryGroup[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [loadingRemote, setLoadingRemote] = useState(false);

  // Estado visual de conexión y Fecha de Sincronización
  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncDate, setLastSyncDate] = useState<Date | null>(null);

  const isRefreshingRef = useRef(false);
  const { computeDecorators } = useInstanceSelectorState();
  const [submittedMap, setSubmittedMap] = useState<Record<string, number>>({});

  // Carga Local
  const loadLocal = useCallback(async () => {
    try {
      await DB.logDbCounts?.();
    } catch {}
    const groups = await DB.selectFormsGroupedByCategory();
    const safeGroups = Array.isArray(groups) ? groups : [];
    setData(safeGroups);

    const allFormIds = safeGroups.flatMap((g) => g.formularios?.map((f) => f.id_formulario) ?? []);
    if (allFormIds.length > 0) {
      const acc: Record<string, number> = {};
      await Promise.all(
        allFormIds.map(async (formId) => {
          try {
            const deco = await computeDecorators(formId, "daily");
            acc[formId] = deco?.submittedCount ?? 0;
          } catch {
            acc[formId] = 0;
          }
        })
      );
      setSubmittedMap(acc);
    } else {
      setSubmittedMap({});
    }
    return safeGroups;
  }, [computeDecorators]);

  // Sincronización con el Servidor
  const revalidateFromServer = useCallback(async () => {
    if (isRefreshingRef.current) return;

    const state = await NetInfo.fetch();
    const online = state.isConnected && (state.isInternetReachable ?? true);

    setIsOffline(!online);

    if (!online) {
      console.log("[home] Sin conexión. Abortando sync.");
      setLoadingRemote(false);
      return;
    }

    isRefreshingRef.current = true;
    setLoadingRemote(true);
    console.log("[home] Online detectado. Sincronizando...");

    try {
      await fetchAndSaveForms();
      await pullAndCacheGroups();
      await syncAllDatasets();

      // ✅ ÉXITO: Actualizamos la fecha global Y el estado local
      setLastUpdatedNow();
      setLastSyncDate(new Date());
    } catch (e: any) {
      console.log("[home/revalidate] fallo:", e?.message ?? e);
    } finally {
      try {
        await loadLocal();
      } finally {
        setLoadingRemote(false);
        isRefreshingRef.current = false;
      }
    }

    // Tareas de fondo
    await cancelAllNotifications();
    const reminder = await findReadyToSubmitReminder(1);
    const today = new Date();
    const dayOfWeek = today.getDay();
    if (reminder) {
      const hour = dayOfWeek === 6 ? 14 : 16;
      if ((dayOfWeek >= 1 && dayOfWeek <= 5) || dayOfWeek === 6) {
        await scheduleTodayAt(hour, 0, reminder.title, reminder.body);
      }
    }

    try {
      const plans = await planAvailabilityNotifications();
      for (const p of plans) {
        const ok = await tryMarkNotificationSent(p.kvKey);
        if (ok) await notifyNow(p.title, p.body);
      }
    } catch (e) {
      console.log(e);
    }

    ensureDailyMaintenanceRegistered();
    runMidnightCatchUpIfNeeded();
  }, [loadLocal]);

  // Listener de Red
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && (state.isInternetReachable ?? true);
      setIsOffline(!online);

      if (online && !isRefreshingRef.current) {
        console.log("[Listener] Internet volvió. Ejecutando sync...");
        revalidateFromServer();
      }
    });
    return () => unsubscribe();
  }, [revalidateFromServer]);

  // Inicialización: Cargar local y fecha guardada
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. Cargar fecha guardada previamente
      const savedDate = getLastUpdatedDate();
      if (savedDate) setLastSyncDate(savedDate);

      // 2. Cargar datos locales y Sync inmediato
      try {
        await loadLocal();
        if (cancelled) return;
        setInitialized(true);
        await revalidateFromServer();
      } catch (e) {
        console.log(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLocal, revalidateFromServer]);

  // Focus effect
  useFocusEffect(
    useCallback(() => {
      if (initialized) {
        // Al volver a la pantalla, refrescamos la fecha desde storage por si acaso
        const savedDate = getLastUpdatedDate();
        if (savedDate) setLastSyncDate(savedDate);

        loadLocal();
        revalidateFromServer();
      }
      return () => {};
    }, [loadLocal, revalidateFromServer, initialized])
  );

  useEffect(() => {
    return onActiveWithInternet(() => revalidateFromServer());
  }, [revalidateFromServer]);

  const handleLogout = async () => {
    try {
      await clearTokens();
    } finally {
      router.replace("/qr");
    }
  };

  const handleRefresh = useCallback(async () => {
    await revalidateFromServer();
  }, [revalidateFromServer]);

  useEffect(() => {
    const init = async () => {
      console.log("##################### Initializing midnight cleanup task...");
      // Asegurar que la task esté registrada solo una vez
      const already = await TaskManager.isTaskRegisteredAsync(MIDNIGHT_CLEAN_TASK);
      console.log("##################### Midnight cleanup task already registered?", already);
      if (!already) {
        // await registerMidnightCleanup(); agregar en un timeout
        console.log("##################### Registering midnight cleanup task...");
        const timeout = setTimeout(async () => {
          await registerMidnightCleanup();
        }, 3000);
        return () => clearTimeout(timeout);
      }

      // Fallback por si el SO nunca disparó la tarea
      const timeout2 = setTimeout(async () => {
        const logout = await ensureDailyCleanupNowIfNeeded();
        if (logout) {
          router.replace("/qr");
        }
      }, 3000);

      return () => clearTimeout(timeout2);
    };
    void init();

    return () => {
      // Desregistrar la tarea al desmontar (ej. logout)
      void unregisterMidnightCleanup();
    };
  }, []);

  return (
    <PageScaffold
      title="Mis formularios"
      variant="categories"
      onRefresh={handleRefresh}
      // 👇 Pasamos la fecha actualizada al Scaffold
      lastSyncProp={lastSyncDate}
    >
      {({ contentFrame, referenceFrame }) => {
        const gap = clamp(contentFrame.width * 0.045, 12, 24);
        const columns = 2;
        const cardWidth = Math.floor((contentFrame.width - gap * (columns - 1)) / columns);

        return (
          <>
            {isOffline && (
              <View
                style={{
                  width: "100%",
                  backgroundColor: "#333",
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  marginBottom: gap,
                  borderRadius: 8,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <View
                  style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#ff4444" }}
                />
                <Text style={{ color: "white", fontSize: 12, fontWeight: "bold" }}>
                  Sin conexión • Datos locales
                </Text>
              </View>
            )}

            {!initialized ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <View key={i} style={{ width: cardWidth }}>
                    <SkeletonLoader preset="card" frame={referenceFrame} />
                    <View style={{ height: 8 }} />
                    <SkeletonLoader preset="title" frame={referenceFrame} />
                  </View>
                ))}
              </View>
            ) : loadingRemote ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
                {Array.from({ length: Math.max(data.length, 6) }).map((_, i) => (
                  <View key={i} style={{ width: cardWidth }}>
                    <SkeletonLoader preset="card" frame={referenceFrame} />
                    <View style={{ height: 8 }} />
                    <SkeletonLoader preset="title" frame={referenceFrame} />
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
                {data.map((item) => {
                  const totalForms = item.formularios.length;
                  const completedForms = item.formularios.reduce((acc, f) => {
                    const count = submittedMap[f.id_formulario] ?? 0;
                    return acc + (count > 0 ? 1 : 0);
                  }, 0);

                  return (
                    <CategoryCard
                      key={item.nombre_categoria}
                      name={item.nombre_categoria}
                      totalForms={totalForms}
                      completedForms={completedForms}
                      onPress={() => {
                        router.push({
                          pathname: "/forms/[category]",
                          params: { category: item.nombre_categoria },
                        });
                      }}
                      referenceFrame={referenceFrame}
                      style={{ width: cardWidth }}
                    />
                  );
                })}
              </View>
            )}

            <View style={{ alignItems: "flex-end", marginTop: gap }}>
              <Button title="Cerrar sesión" size="sm" onPress={handleLogout} />
            </View>
          </>
        );
      }}
    </PageScaffold>
  );
};

export default Home;
