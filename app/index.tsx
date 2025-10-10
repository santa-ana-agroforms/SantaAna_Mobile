// app/index.tsx
import { clearTokens } from "@/api/client";
import type { FormCategoryGroup } from "@/api/forms/types";
import Button from "@/components/atoms/Button";
import CategoryCard from "@/components/molecules/CategoryCard";
import PageScaffold from "@/components/templates/PageScaffold";
import { listEntriesSummary } from "@/db/form-entries";
import { DB } from "@/db/sqlite";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const Home: React.FC = () => {
  const [data, setData] = useState<FormCategoryGroup[]>([]);
  const loadLocal = useCallback(async () => {
    await DB.logDbCounts?.(); // si exportas la util en DB
    const groups = await DB.selectFormsGroupedByCategory();
    setData(groups);
  }, []);

  useEffect(() => {
    (async () => {
      const forms = await DB.selectFormsGroupedByCategory();
      setData(forms);
    })();
    loadLocal();
  }, []);

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
