// app/index.tsx
import { fetchAndSaveForms } from "@/api/forms";
import type { FormCategoryGroup } from "@/api/forms/types";
import Button from "@/components/atoms/Button";
import PageScaffold from "@/components/templates/PageScaffold";
import { selectFormsGroupedByCategory } from "@/db/sqlite";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import "../global.css";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [forms, setForms] = useState<FormCategoryGroup[]>([]);
  useEffect(() => {
    if (!loading) {
      (async () => {
        const f = await selectFormsGroupedByCategory();
        setForms(f);
      })();
    }
  }, [loading]);

  return (
    <PageScaffold title="Calidad de corte manual">
      <Button
        title="Iniciar escaneo QR"
        onPress={() => {
          const controller = new AbortController();
          fetchAndSaveForms(setLoading, controller.signal);
        }}
      ></Button>
      {loading && (
        <View>
          <Text>Cargando formularios...</Text>
        </View>
      )}
      {forms.map((category) => (
        <View key={category.nombre_categoria}>
          <Text>{category.nombre_categoria}</Text>
          <Text>{category.descripcion}</Text>
          <Text>{category.formularios.length}</Text>
        </View>
      ))}
    </PageScaffold>
  );
}
