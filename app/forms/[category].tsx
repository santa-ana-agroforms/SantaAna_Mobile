// app/forms/[category].tsx
import SkeletonLoader from "@/components/atoms/SkeletonLoader";
import { Body } from "@/components/atoms/Typography";
import FormListItem from "@/components/molecules/FormListItem";
import PageScaffold, { type ScaffoldDimensions } from "@/components/templates/PageScaffold";
import { DB } from "@/db/sqlite";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

type VersionVigente = { id_index_version: string; fecha_creacion: string };
type Formulario = { id_formulario: string; nombre: string; version_vigente: VersionVigente };
export type FormCategoryGroup = {
  nombre_categoria: string;
  descripcion: string | null;
  formularios: { id_formulario: string; nombre: string; version_vigente: VersionVigente }[];
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const FormsByCategoryScreen: React.FC = () => {
  const { category } = useLocalSearchParams<{ category: string }>();
  const [loading, setLoading] = useState(true);
  const [grupo, setGrupo] = useState<FormCategoryGroup | null>(null);

  // 1) Leer siempre lo que haya en DB (rápido)
  const loadLocal = useCallback(async () => {
    const groups = await DB.selectFormsGroupedByCategory();
    const found = (groups ?? []).find((g) => g.nombre_categoria === category);
    setGrupo(found ?? null);
  }, [category]);

  useEffect(() => {
    (async () => {
      try {
        await loadLocal();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadLocal]);

  const headerTitle = String(category);

  // 🔸 Skeleton: mientras carga (aunque aún no tengamos grupo)
  if (loading && !grupo) {
    return (
      <PageScaffold title={headerTitle} variant="groups">
        {({ referenceFrame, contentFrame }: ScaffoldDimensions) => {
          const gapY = clamp(contentFrame.width * 0.04, 12, 24);
          const items = Array.from({ length: 6 });
          return (
            <View style={{ gap: gapY }}>
              {items.map((_, i) => (
                <View key={i} style={{ gap: referenceFrame.height * 0.01 }}>
                  {/* fila: título a la izq + chip de estado a la der */}
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <SkeletonLoader preset="title" frame={referenceFrame} />
                    </View>
                    <View style={{ width: referenceFrame.width * 0.22, marginLeft: 12 }}>
                      <SkeletonLoader preset="button" frame={referenceFrame} />
                    </View>
                  </View>
                  {/* subtítulo / fechas */}
                  <SkeletonLoader
                    preset="text"
                    frame={referenceFrame}
                    lines={1}
                    lineHeight={referenceFrame.height * 0.018}
                    lastLineWidthPct={40}
                  />
                </View>
              ))}
            </View>
          );
        }}
      </PageScaffold>
    );
  }

  // 🔸 Si carga y el grupo existe pero aún no hay formularios, muestra skeleton igual
  if (loading && grupo && (grupo.formularios?.length ?? 0) === 0) {
    return (
      <PageScaffold title={headerTitle} variant="groups">
        {({ referenceFrame, contentFrame }: ScaffoldDimensions) => {
          const gapY = clamp(contentFrame.width * 0.04, 12, 24);
          const items = Array.from({ length: 6 });
          return (
            <View style={{ gap: gapY }}>
              {items.map((_, i) => (
                <View key={i} style={{ gap: referenceFrame.height * 0.01 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <SkeletonLoader preset="title" frame={referenceFrame} />
                    </View>
                    <View style={{ width: referenceFrame.width * 0.22, marginLeft: 12 }}>
                      <SkeletonLoader preset="button" frame={referenceFrame} />
                    </View>
                  </View>
                  <SkeletonLoader
                    preset="text"
                    frame={referenceFrame}
                    lines={1}
                    lineHeight={referenceFrame.height * 0.018}
                    lastLineWidthPct={40}
                  />
                </View>
              ))}
            </View>
          );
        }}
      </PageScaffold>
    );
  }

  // 🔸 Estado vacío real (sin carga y sin formularios)
  if (!loading && (!grupo || (grupo.formularios?.length ?? 0) === 0)) {
    return (
      <PageScaffold title={headerTitle} variant="categories">
        <Body>{`No hay formularios en “${headerTitle}”.`}</Body>
      </PageScaffold>
    );
  }

  // 🔸 Datos listos
  return (
    <PageScaffold title={headerTitle} variant="groups">
      {({ contentFrame, referenceFrame }: ScaffoldDimensions) => {
        const gapY = clamp(contentFrame.width * 0.04, 12, 24);
        return (
          <View style={{ gap: gapY }}>
            {grupo!.formularios.map((f) => {
              const estado = getEstado(f);
              const asignado = f.version_vigente?.fecha_creacion
                ? new Date(f.version_vigente.fecha_creacion)
                : null;
              const disponibleHasta = getFechaDisponibleHasta(asignado);

              return (
                <FormListItem
                  key={f.id_formulario}
                  title={f.nombre}
                  statusText={estado.texto}
                  statusColor={estado.color}
                  assignedAt={asignado}
                  availableUntil={disponibleHasta}
                  onPress={() =>
                    router.push({
                      pathname: "/form/[formId]",
                      params: {
                        formId: f.id_formulario,
                        versionId: f.version_vigente?.id_index_version ?? "",
                      },
                    })
                  }
                  referenceFrame={referenceFrame}
                  contentFrame={contentFrame}
                />
              );
            })}
          </View>
        );
      }}
    </PageScaffold>
  );
};

export default FormsByCategoryScreen;

/* ------------ placeholders UI ------------ */
const getEstado = (
  f: Formulario
): { texto: "Pendiente" | "En progreso" | "Completado"; color: string } => {
  const created = f.version_vigente?.fecha_creacion
    ? new Date(f.version_vigente.fecha_creacion)
    : null;
  if (!created) return { texto: "Pendiente", color: "#9CA3AF" };
  const diff = Date.now() - created.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days > 20) return { texto: "Completado", color: "#2E7D32" };
  if (days > 7) return { texto: "En progreso", color: "#8B4513" };
  return { texto: "Pendiente", color: "#9CA3AF" };
};

const getFechaDisponibleHasta = (asignado: Date | null): Date | null => {
  if (!asignado) return null;
  const d = new Date(asignado);
  d.setDate(d.getDate() + 30);
  return d;
};
