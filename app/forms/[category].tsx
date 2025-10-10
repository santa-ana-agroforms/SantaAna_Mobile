// app/forms/[category].tsx
import { fetchAndSaveForms } from "@/api/forms";
import { pullAndCacheGroups } from "@/api/groups";
import { Body } from "@/components/atoms/Typography";
import FormListItem from "@/components/molecules/FormListItem";
import PageScaffold, { type ScaffoldDimensions } from "@/components/templates/PageScaffold";
import { DB } from "@/db/sqlite";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const abortRef = useRef<AbortController | null>(null);

  // 1) Leer siempre lo que haya en DB (rápido)
  const loadLocal = useCallback(async () => {
    const groups = await DB.selectFormsGroupedByCategory();
    const found = groups.find((g) => g.nombre_categoria === category);
    setGrupo(found ?? null);
  }, [category]);

  // 2) Revalidar red → guardar en DB → releer DB
  const revalidate = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await fetchAndSaveForms(setLoading, ctrl.signal);
      await pullAndCacheGroups(); // si dependes de esto para renderizar formularios
    } catch (e) {
      // opcional: loggear
      console.log("[forms/revalidate] fallo fetch:", (e as any)?.message);
    } finally {
      await loadLocal(); // releer DB con lo último (aunque haya fallado, mantiene local)
      setLoading(false);
    }
  }, [loadLocal]);

  // Carga inicial: primero local (instantáneo), luego revalidación
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await loadLocal();
      if (!mounted) return;
      await revalidate();
    })();
    return () => {
      mounted = false;
      abortRef.current?.abort();
    };
  }, [category, loadLocal, revalidate]);

  // Revalidar al volver al foco (por si se agregaron formularios nuevos)
  useFocusEffect(
    useCallback(() => {
      revalidate();
      return () => abortRef.current?.abort();
    }, [revalidate])
  );

  const headerTitle = useMemo(() => grupo?.nombre_categoria ?? "Formularios", [grupo]);

  if (loading && !grupo) {
    return (
      <PageScaffold title={String(category)} variant="categories">
        <Body>Cargando…</Body>
      </PageScaffold>
    );
  }

  if (!grupo || (grupo.formularios?.length ?? 0) === 0) {
    return (
      <PageScaffold title="Formularios" variant="categories">
        <Body>
          {`No hay formularios en “${String(category)}”. `}
          {loading ? "Actualizando…" : "Toca recargar desde el encabezado."}
        </Body>
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
