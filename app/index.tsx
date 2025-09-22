// app/index.tsx
import { clearTokens } from "@/api/client";
import { FormCategoryGroup } from "@/api/forms/types";
import Button from "@/components/atoms/Button";
import { Body, Title } from "@/components/atoms/Typography";
import PageScaffold from "@/components/templates/PageScaffold";
import { DB } from "@/db/sqlite";
import { useResponsive } from "@/hooks/useResponsive";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

export default function Home() {
  const { rem, gutter } = useResponsive();
  const [data, setData] = useState<FormCategoryGroup[]>([]);

  useEffect(() => {
    (async () => {
      const forms = await DB.selectFormsGroupedByCategory();
      console.log("[DB] forms:", forms);
      setData(forms);
    })();
  }, []);

  const handleLogout = async () => {
    try {
      (async () => {
        await clearTokens();
      })();
    } finally {
      router.replace("/qr"); // cambia por "/(auth)/login" o la ruta que uses
    }
  };

  return (
    <PageScaffold title="Mis formularios" variant="categories">
      {/* Grid 2 columnas (el PageScaffold ya trae ScrollView) */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        {data.map((item) => (
          <View
            key={item.nombre_categoria}
            style={[
              styles.card,
              {
                padding: gutter,
                marginBottom: gutter,
                width: "48%",
                justifyContent: "space-between",
              },
            ]}
          >
            <Title
              style={{
                fontSize: rem * 1.9,
                textAlign: "center",
                color: "#5B4B24",
              }}
            >
              {item.nombre_categoria}
            </Title>

            <View style={{ height: 8 }} />

            <Body color="secondary">Formularios: {item.formularios.length}</Body>
            <Body color="secondary">Completados: {item.formularios.filter((f) => f).length}</Body>

            <View style={{ height: 12 }} />

            <Button
              title="INGRESAR"
              size="lg"
              onPress={() => {
                router.push({
                  pathname: "/forms/[category]",
                  params: { category: item.nombre_categoria },
                });
              }}
            />
          </View>
        ))}
      </View>
      {true && (
        <View style={{ alignItems: "flex-end", marginBottom: gutter }}>
          <Button title="Cerrar sesión (TEMP)" size="sm" onPress={handleLogout} />
        </View>
      )}
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    // sombra iOS/Android
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
});
