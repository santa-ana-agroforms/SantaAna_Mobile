// app/forms/[category].tsx (FormsByCategoryScreen)
import { Body } from "@/components/atoms/Typography";
import FormListItem from "@/components/molecules/FormListItem";
import PageScaffold, {
  type ScaffoldDimensions,
} from "@/components/templates/PageScaffold";
import { DB } from "@/db/sqlite";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

// app/forms/[category].tsx
// 👈 NUEVO

// Tipos mínimos con lo que ya tienes
type VersionVigente = {
  id_index_version: string;
  fecha_creacion: string; // ISO
};

type Formulario = {
  id_formulario: string;
  nombre: string;
  version_vigente: VersionVigente;
};

// "@/api/forms/types"
export type FormCategoryGroup = {
  nombre_categoria: string;
  descripcion: string | null;
  formularios: {
    id_formulario: string;
    nombre: string;
    version_vigente: {
      id_index_version: string;
      fecha_creacion: string;
    };
  }[];
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const FormsByCategoryScreen: React.FC = () => {
  const { category } = useLocalSearchParams<{ category: string }>();

  const [loading, setLoading] = useState(true);
  const [grupo, setGrupo] = useState<FormCategoryGroup | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const groups: FormCategoryGroup[] =
          await DB.selectFormsGroupedByCategory();
        const found = groups.find((g) => g.nombre_categoria === category);
        setGrupo(found ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [category]);

  const headerTitle = useMemo(
    () => grupo?.nombre_categoria ?? "Formularios",
    [grupo],
  );

  if (loading) {
    return (
      <PageScaffold title={String(category)} variant="categories">
        <Body>Cargando…</Body>
      </PageScaffold>
    );
  }

  if (!grupo) {
    return (
      <PageScaffold title="Formularios" variant="categories">
        <Body>No se encontró la categoría: {String(category)}</Body>
      </PageScaffold>
    );
  }

  return (
    <PageScaffold title={headerTitle} variant="groups">
      {({ contentFrame, referenceFrame }: ScaffoldDimensions) => {
        const gapY = clamp(contentFrame.width * 0.04, 12, 24);

        return (
          <View style={{ gap: gapY }}>
            {grupo.formularios.map((f) => {
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

/* ------------ lógica placeholder (ajusta cuando tengas datos reales) ------------ */
const getEstado = (
  f: Formulario,
): {
  texto: "Pendiente" | "En progreso" | "Completado";
  color: string;
} => {
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
  d.setDate(d.getDate() + 30); // placeholder: +30 días
  return d;
};
