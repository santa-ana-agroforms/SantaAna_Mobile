import { FlatList, Text, View } from "react-native";
import { useResponsive } from "@/hooks/useResponsive";

import "../global.css"
import { useContainerLayout } from "@/components/layout/ContainerSizer";
import PageScaffold from "@/components/templates/PageScaffold";

const categories = [
  { id: "1", title: "Bitácora de campo", formulated: 5, completed: 5 },
  { id: "2", title: "Calidad de corte", formulated: 5, completed: 5 },
  { id: "3", title: "Supervisión de labores", formulated: 5, completed: 5 },
  { id: "4", title: "Riesgos y drenajes", formulated: 5, completed: 5 },
];

function CardsGrid() {
  const box = useContainerLayout();          
  const { columns, gutter, rem } = useResponsive();

  const cardW = Math.round((box!.width - gutter * (columns - 1)) / columns);

  return (
    <FlatList
      data={categories}
      key={columns}
      keyExtractor={(i) => i.id}
      numColumns={columns}
      // sin columnWrapperStyle gap
      contentContainerStyle={{ paddingBottom: gutter }}
      renderItem={({ item, index }) => {
        const isLastInRow = (index % columns) === columns - 1;
        return (
          <View
            className="bg-white rounded-2xl border border-border"
            style={{
              width: cardW,
              padding: 12,
              marginRight: isLastInRow ? 0 : gutter,   
              marginBottom: gutter,                    
              overflow: "hidden",
            }}
          >
            <Text className="text-text-primary" style={{ fontFamily: "Inter_600SemiBold", fontSize: rem }}>
              {item.title}
            </Text>
            <Text className="text-text-secondary mt-1">Formulados: {item.formulated}</Text>
            <Text className="text-text-secondary">Completados: {item.completed}</Text>
            <View className="bg-primary-600 mt-3 rounded-2xl items-center py-3">
              <Text className="text-white" style={{ fontFamily: "Inter_600SemiBold" }}>INGRESAR</Text>
            </View>
          </View>
        );
      }}
    />
  );
}

export default function FormsHome() {
  return (
    <PageScaffold title="Mis formularios">
      <CardsGrid />
    </PageScaffold>
  );
}
