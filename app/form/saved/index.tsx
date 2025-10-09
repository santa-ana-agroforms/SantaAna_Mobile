// app/form/saved/index.tsx
import PageScaffold from "@/components/templates/PageScaffold";
import { getEntryById } from "@/db/form-entries";
import { useFormPersistence } from "@/forms/state/useFormPersistence";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";

const SavedEntriesScreen = () => {
  const router = useRouter();
  const { entriesSummary, refreshSummary, loading } = useFormPersistence();

  useEffect(() => {
    refreshSummary().catch(() => {});
  }, [refreshSummary]);

  const openOne = async (local_id: string) => {
    const saved = await getEntryById(local_id);
    if (!saved) {
      Alert.alert("Ups", "No se encontró el registro.");
      return;
    }
    // Redirigimos a la misma ruta de form, pero con ?restored=<local_id>
    router.push({
      pathname: "/form/[formId]",
      params: { formId: saved.form_id, restored: local_id },
    });
  };

  return (
    <PageScaffold title="Borradores" variant="groups">
      <FlatList
        data={entriesSummary}
        keyExtractor={(it) => it.local_id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshSummary} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#E6E6E6",
              backgroundColor: "white",
            }}
            onPress={() => openOne(item.local_id)}
          >
            <Text style={{ fontWeight: "700" }}>{item.form_name}</Text>
            <View style={{ height: 4 }} />
            <Text style={{ color: "#555" }}>Versión: {item.index_version_id}</Text>
            <Text style={{ color: "#777" }}>Guardado: {item.filled_at_local}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={{ padding: 16 }}>
            <Text style={{ color: "#666" }}>No hay borradores guardados aún.</Text>
          </View>
        }
      />
    </PageScaffold>
  );
};

export default SavedEntriesScreen;
