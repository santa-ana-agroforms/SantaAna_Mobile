// app/index.tsx
import { clearTokens } from "@/api/client";
import { fetchAndSaveForms } from "@/api/forms";
import type { FormCategoryGroup } from "@/api/forms/types";
import { pullAndCacheGroups } from "@/api/groups";
import Button from "@/components/atoms/Button";
import CategoryCard from "@/components/molecules/CategoryCard";
import PageScaffold from "@/components/templates/PageScaffold";
import { listEntriesSummary } from "@/db/form-entries";
import { DB } from "@/db/sqlite";
import { onActiveWithInternet } from "@/utils/appstate";
import { isOnline, onReconnectOnce } from "@/utils/network";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const Home: React.FC = () => {
  const [data, setData] = useState<FormCategoryGroup[]>([]);
  const isRefreshingRef = useRef(false);

  // Lee SIEMPRE lo que haya en SQLite (rápido)
  const loadLocal = useCallback(async () => {
    await DB.logDbCounts?.();
    const groups = await DB.selectFormsGroupedByCategory();
    setData(groups);
  }, []);

  // Pull remoto -> guarda en DB -> relee local (con gating de red y anti-duplicado)
  const revalidateFromServer = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      if (!(await isOnline())) {
        // Si no hay internet, quedate escuchando el primer reconnect (una sola vez)
        onReconnectOnce(() => revalidateFromServer());
        return;
      }
      await fetchAndSaveForms(); // /forms/tree -> SQLite
      await pullAndCacheGroups(); // /groups     -> SQLite (si lo usás)
    } catch (e: any) {
      console.log("[home/revalidate] fallo:", e?.message ?? e);
    } finally {
      await loadLocal(); // siempre relee lo último que quedó en SQLite
      isRefreshingRef.current = false;
    }
  }, [loadLocal]);

  // 1) Monta: muestra lo local altiro
  useEffect(() => {
    loadLocal();
  }, [loadLocal]);

  // 2) Enfocar pantalla: SIEMPRE recarga local + (si hay red) revalida del server
  useFocusEffect(
    useCallback(() => {
      console.log("\n\n[home] focus, recargando local + revalidando remoto");
      // Mostrar lo local de inmediato
      loadLocal();
      // Intentar revalidar (si hay red); si no, se registrará para el próximo reconnect
      revalidateFromServer();
      return () => {
        // nada que limpiar aquí
      };
    }, [loadLocal, revalidateFromServer])
  );

  // 3) Cuando la app vuelve del background y HAY internet, revalidá
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

  return (
    <PageScaffold title="Mis formularios" variant="categories">
      {({ contentFrame, referenceFrame }) => {
        const gap = clamp(contentFrame.width * 0.045, 12, 24);
        const columns = 2;
        const cardWidth = Math.floor((contentFrame.width - gap * (columns - 1)) / columns);

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

            <View style={{ alignItems: "flex-end", marginTop: gap }}>
              <Button
                title="Guardados"
                size="sm"
                onPress={() => {
                  (async () => {
                    const entries = await listEntriesSummary();
                    console.log("Entries:", entries);
                  })();
                  router.push("/form/saved");
                }}
              />
            </View>
          </>
        );
      }}
    </PageScaffold>
  );
};

export default Home;
