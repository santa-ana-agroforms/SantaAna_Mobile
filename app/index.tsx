// app/index.tsx
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
import { isOnline, onReconnectOnce } from "@/utils/network";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";

// ✅ Reusar decorators
import { useInstanceSelectorState } from "@/forms/state/useInstanceSelectorState";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const Home: React.FC = () => {
  const [data, setData] = useState<FormCategoryGroup[]>([]);
  const [initialized, setInitialized] = useState(false); // ya hice 1ra lectura local
  const [loadingRemote, setLoadingRemote] = useState(false); // estoy trayendo del server
  const isRefreshingRef = useRef(false);

  // ← usaremos computeDecorators para obtener submittedCount por formId
  const { computeDecorators } = useInstanceSelectorState();

  // Mapa global de enviados por formulario (formId → submittedCount)
  const [submittedMap, setSubmittedMap] = useState<Record<string, number>>({});

  // Lee lo que haya en SQLite y calcula submittedMap con decorators
  const loadLocal = useCallback(async () => {
    try {
      await DB.logDbCounts?.();
    } catch {}
    const groups = await DB.selectFormsGroupedByCategory();
    const safeGroups = Array.isArray(groups) ? groups : [];
    setData(safeGroups);

    // Construir lista de formIds y calcular submittedCount usando decorators
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

  // Revalidación remota segura
  const revalidateFromServer = useCallback(async () => {
    console.log("[home/revalidate] iniciando revalidación desde server...");
    if (isRefreshingRef.current) return;

    const online = await isOnline();
    if (!online) {
      onReconnectOnce(() => revalidateFromServer());
      setLoadingRemote(false);
      return;
    }

    isRefreshingRef.current = true;
    setLoadingRemote(true); // 🔥 enciende skeleton

    console.log("\n\n[home/revalidate] online, revalidando...");

    try {
      await fetchAndSaveForms(); // /forms/tree -> SQLite
      console.log("\n\n[home/revalidate] forms revalidados");
      await pullAndCacheGroups(); // /groups -> SQLite
      await syncAllDatasets(); // otros datasets
    } catch (e: any) {
      console.log("[home/revalidate] fallo:", e?.message ?? e);
    } finally {
      try {
        await loadLocal(); // repinta desde DB y recalcula submittedMap
      } finally {
        setLoadingRemote(false);
        isRefreshingRef.current = false;
      }
    }

    // Notificaciones
    await cancelAllNotifications();
    const reminder = await findReadyToSubmitReminder(1);
    const today = new Date();
    const dayOfWeek = today.getDay();
    if (reminder && dayOfWeek >= 1 && dayOfWeek <= 5) {
      await scheduleTodayAt(16, 0, reminder.title, reminder.body);
    } else if (reminder && dayOfWeek === 6) {
      await scheduleTodayAt(14, 0, reminder.title, reminder.body);
    }

    try {
      const plans = await planAvailabilityNotifications();
      for (const p of plans) {
        const ok = await tryMarkNotificationSent(p.kvKey);
        if (ok) await notifyNow(p.title, p.body);
      }
    } catch (e) {
      console.log("[home/revalidate] error notificando disponibilidad:", e);
    }

    ensureDailyMaintenanceRegistered();
    runMidnightCatchUpIfNeeded();
  }, [loadLocal]);

  // 1) Montaje: asegúrate de marcar initialized SIEMPRE
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadLocal();
      } catch (e) {
        console.log("[home/mount] loadLocal error:", (e as any)?.message ?? e);
      } finally {
        if (!cancelled) setInitialized(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLocal]);

  // 2) Enfoque pantalla: recarga local
  useFocusEffect(
    useCallback(() => {
      loadLocal();
      // revalidateFromServer(); // si quisieras revalidar al enfocar
      return () => {};
    }, [loadLocal])
  );

  // 3) App vuelve activa con internet → revalidar
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

  return (
    <PageScaffold title="Mis formularios" variant="categories" onRefresh={handleRefresh}>
      {({ contentFrame, referenceFrame }) => {
        const gap = clamp(contentFrame.width * 0.045, 12, 24);
        const columns = 2;
        const cardWidth = Math.floor((contentFrame.width - gap * (columns - 1)) / columns);

        // 1) Skeleton inicial (antes de 1ra lectura local)
        if (!initialized) {
          const skeletonRows = 3;
          const skeletonItems = Array.from({ length: skeletonRows * columns });
          return (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
                {skeletonItems.map((_, i) => (
                  <View key={i} style={{ width: cardWidth }}>
                    <SkeletonLoader preset="card" frame={referenceFrame} />
                    <View style={{ height: referenceFrame.height * 0.012 }} />
                    <SkeletonLoader preset="title" frame={referenceFrame} />
                  </View>
                ))}
              </View>
              <View style={{ alignItems: "flex-end", marginTop: gap }}>
                <SkeletonLoader preset="button" frame={referenceFrame} width="40%" />
              </View>
              <View style={{ alignItems: "flex-end", marginTop: gap }}>
                <SkeletonLoader preset="button" frame={referenceFrame} width="40%" />
              </View>
            </>
          );
        }

        // 2) Skeleton mientras refresca remoto
        if (loadingRemote) {
          const minRows = 3;
          const skeletonCount = Math.max(data.length, minRows * columns);
          const skeletonItems = Array.from({ length: skeletonCount });

          return (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
                {skeletonItems.map((_, i) => (
                  <View key={i} style={{ width: cardWidth }}>
                    <SkeletonLoader preset="card" frame={referenceFrame} />
                    <View style={{ height: referenceFrame.height * 0.012 }} />
                    <SkeletonLoader preset="title" frame={referenceFrame} />
                  </View>
                ))}
              </View>
              <View style={{ alignItems: "flex-end", marginTop: gap }}>
                <SkeletonLoader preset="button" frame={referenceFrame} width="40%" />
              </View>
            </>
          );
        }

        // 3) Contenido normal
        return (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
              {data.map((item) => {
                const totalForms = item.formularios.length;

                // ✔ “Completado” si el form tiene ≥1 envío (submittedCount > 0)
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
