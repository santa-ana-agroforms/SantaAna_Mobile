// app/index.tsx
import { FormCategoryGroup } from "@/api/forms/types";
import Button from "@/components/atoms/Button";
import { Body, Title } from "@/components/atoms/Typography";
import PageScaffold from "@/components/templates/PageScaffold";
import { DB } from "@/db/sqlite";
import { useResponsive } from "@/hooks/useResponsive";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

type Category = {
  id: string;
  nombre: string;
  totalFormularios: number;
  completados: number;
};

const demoData: Category[] = [
  { id: "1", nombre: "Bitácora de campo", totalFormularios: 5, completados: 5 },
  { id: "2", nombre: "Calidad de corte", totalFormularios: 5, completados: 5 },
  {
    id: "3",
    nombre: "Supervisión de labores",
    totalFormularios: 5,
    completados: 5,
  },
  {
    id: "4",
    nombre: "Riesgos y drenajes",
    totalFormularios: 5,
    completados: 5,
  },
  {
    id: "5",
    nombre: "Supervisión de labores",
    totalFormularios: 5,
    completados: 5,
  },
  {
    id: "6",
    nombre: "Riesgos y drenajes",
    totalFormularios: 5,
    completados: 5,
  },
];

export default function Home() {
  const { rem, gutter } = useResponsive();
  const [data, setData] = useState<FormCategoryGroup[]>([]);

  useEffect(() => {
    (async () => {
      const forms = await DB.selectFormsGroupedByCategory();
      setData(forms);
    })();
  }, []);

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
              { padding: gutter, marginBottom: gutter, width: "48%" },
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

            <Body color="secondary">
              Formularios: {item.formularios.length}
            </Body>
            <Body color="secondary">
              Completados: {item.formularios.filter((f) => f).length}
            </Body>

            <View style={{ height: 12 }} />

            <Button
              title="INGRESAR"
              size="lg"
              onPress={() => {
                // aquí navegas a la lista/grupo correspondiente
                // p. ej.: router.push({ pathname: "/form", params: { categoryId: item.id } })
              }}
            />
          </View>
        ))}
      </View>
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
