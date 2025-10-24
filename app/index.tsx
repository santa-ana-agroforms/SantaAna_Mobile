// app/index.tsx
import { clearTokens } from "@/api/client";
import { syncAllDatasets } from "@/api/datasets";
import { fetchAndSaveForms } from "@/api/forms";
import type { FormCategoryGroup } from "@/api/forms/types";
import { pullAndCacheGroups } from "@/api/groups";
import Button from "@/components/atoms/Button";
import SkeletonLoader from "@/components/atoms/SkeletonLoader";
import CategoryCard from "@/components/molecules/CategoryCard";
import PageScaffold from "@/components/templates/PageScaffold";
import { findReadyToSubmitReminder } from "@/db/form-entries";
import { DB } from "@/db/sqlite";
import { notifyNow } from "@/notifications";
import { onActiveWithInternet } from "@/utils/appstate";
import { isOnline, onReconnectOnce } from "@/utils/network";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const Home: React.FC = () => {
  const [data, setData] = useState<FormCategoryGroup[]>([]);
  const [initialized, setInitialized] = useState(false); // ya hice 1ra lectura local
  const [loadingRemote, setLoadingRemote] = useState(false); // estoy trayendo del server
  const isRefreshingRef = useRef(false);

  // Lee lo que haya en SQLite
  const loadLocal = useCallback(async () => {
    try {
      await DB.logDbCounts?.();
    } catch {}
    const groups = await DB.selectFormsGroupedByCategory();
    const safeGroups = Array.isArray(groups) ? groups : [];
    setData(safeGroups);
    return safeGroups;
  }, []);

  // Revalidación remota segura
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

    // 🔥 Enciende el skeleton inmediatamente (antes de cualquier await)
    setLoadingRemote(true);

    console.log("\n\n[home/revalidate] online, revalidando...");

    try {
      await fetchAndSaveForms(); // /forms/tree -> SQLite (sin callback)
      console.log("\n\n[home/revalidate] forms revalidados");
      await pullAndCacheGroups(); // /groups -> SQLite (si aplica)
      await syncAllDatasets(); // otros datasets
    } catch (e: any) {
      console.log("[home/revalidate] fallo:", e?.message ?? e);
    } finally {
      try {
        await loadLocal(); // pinta lo último que quedó en DB
      } finally {
        setLoadingRemote(false); // ✅ apaga al final de TODO el pipeline
        isRefreshingRef.current = false;
      }
    }

    const reminder = await findReadyToSubmitReminder(0.04);
    if (reminder) await notifyNow(reminder.title, reminder.body);
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

  // 2) Enfoque pantalla: recarga local + revalida remoto
  useFocusEffect(
    useCallback(() => {
      loadLocal();
      // revalidateFromServer();
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

        // 2) MOSTRAR SKELETON TAMBIÉN CUANDO YA HAY DATOS
        if (loadingRemote) {
          // Si ya hay datos, igual mostramos un skeleton “del mismo tamaño”
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
              {/* (Opcional) botón skeleton mientras refresca */}
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
              {data.map((item) => (
                <CategoryCard
                  key={item.nombre_categoria}
                  name={item.nombre_categoria}
                  totalForms={item.formularios.length}
                  completedForms={item.formularios.filter(Boolean).length}
                  onPress={() =>
                    router.push({
                      pathname: "/forms/[category]",
                      params: { category: item.nombre_categoria },
                    })
                  }
                  referenceFrame={referenceFrame}
                  style={{ width: cardWidth }}
                />
              ))}
            </View>

            <View style={{ alignItems: "flex-end", marginTop: gap }}>
              <Button title="Cerrar sesión (TEMP)" size="sm" onPress={handleLogout} />
            </View>
          </>
        );
      }}
    </PageScaffold>
  );
};

export default Home;
