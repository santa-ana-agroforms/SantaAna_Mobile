// app/forms/[category].tsx
import SkeletonLoader from "@/components/atoms/SkeletonLoader";
import { Body } from "@/components/atoms/Typography";
import FormListItem from "@/components/molecules/FormListItem";
import PageScaffold, { type ScaffoldDimensions } from "@/components/templates/PageScaffold";
import { DB } from "@/db/sqlite";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { InteractionManager, View } from "react-native";

/** -----------------------------------------
 * Tipos locales
 * ----------------------------------------- */
type VersionVigente = { id_index_version: string; fecha_creacion: string };
type Formulario = { id_formulario: string; nombre: string; version_vigente: VersionVigente };
export type FormCategoryGroup = {
  nombre_categoria: string;
  descripcion: string | null;
  formularios: { id_formulario: string; nombre: string; version_vigente: VersionVigente }[];
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** -----------------------------------------
 * Helpers de estado/fecha
 * ----------------------------------------- */
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

/** -----------------------------------------
 * PRELOAD local (en este archivo)
 *  - Precarga bundle de la ruta real + FormPage
 *  - Calienta DB/JSI
 *  - Lee form y grupos
 *  - Reusa promesas por formId (memo)
 * ----------------------------------------- */
const pickGroupIdFromConfig = (cfg: any): string | null => {
  if (!cfg) return null;
  const cand =
    cfg.id_group ??
    cfg.id_grupo ??
    cfg.groupId ??
    cfg.group_id ??
    cfg.idGroup ??
    cfg.group?.id ??
    null;
  return cand != null ? String(cand) : null;
};

// Mapa de preloads por formulario para no repetir trabajo si el usuario hace tap varias veces
const preloadMap = new Map<string, Promise<void>>();

// Debounce por formId para no disparar demasiado mientras el dedo está bajando
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

const ensureWarmDb = async () => {
  try {
    await DB.ensureMigrated();
    await DB.logDbCounts(); // SELECTs baratas calientan WAL/JSI y el bridge
  } catch {}
};

const preloadFormScreenAndData = async (formId: string, versionId: string) => {
  const key = `${formId}:${versionId}`;
  if (preloadMap.has(key)) return preloadMap.get(key)!;

  const p = (async () => {
    // 1) Precarga módulos: ruta real + pantalla
    try {
      await Promise.all([import("app/form/[formId]"), import("@/screens/FormPage")]);
    } catch {}

    // 2) Calienta DB/JSI
    await ensureWarmDb();

    // 3) Lee formulario completo
    const form = await DB.selectFormFromGroupedById(formId);
    if (!form) return;

    // 4) Prelee grupos usados por campos
    const groupIds = new Set<string>();
    for (const p of form.paginas ?? []) {
      for (const f of p.campos ?? []) {
        const gid = pickGroupIdFromConfig(f.config);
        if (gid) groupIds.add(gid);
      }
    }
    await Promise.all(
      Array.from(groupIds).map(async (gid) => {
        try {
          await DB.selectGroupById(gid);
        } catch {}
      })
    );

    // 5) (Opcional) defer de assets/datasets no críticos
    InteractionManager.runAfterInteractions(() => {
      // Ej: precargar imágenes/íconos usados en la pantalla del form
    });
  })();

  preloadMap.set(key, p);
  // Limpia si falla para poder reintentar en el próximo tap
  p.catch(() => preloadMap.delete(key));
  return p;
};

const requestPreloadWithDebounce = (formId: string, versionId: string, wait = 400) => {
  const key = `${formId}:${versionId}`;
  if (debounceTimers.has(key)) return;
  const t = setTimeout(() => {
    debounceTimers.delete(key);
    preloadFormScreenAndData(formId, versionId);
  }, wait);
  debounceTimers.set(key, t);
};

/** -----------------------------------------
 * Pantalla
 * ----------------------------------------- */
const FormsByCategoryScreen: React.FC = () => {
  const { category } = useLocalSearchParams<{ category: string }>();
  const [loading, setLoading] = useState(true);
  const [grupo, setGrupo] = useState<FormCategoryGroup | null>(null);

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

  // Limpia timers de debounce al desmontar
  useEffect(() => {
    return () => {
      for (const t of debounceTimers.values()) clearTimeout(t);
      debounceTimers.clear();
    };
  }, []);

  const headerTitle = String(category);

  // Skeletons y estados como ya los tenías:
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

  if (!loading && (!grupo || (grupo.formularios?.length ?? 0) === 0)) {
    return (
      <PageScaffold title={headerTitle} variant="categories">
        <Body>{`No hay formularios en “${headerTitle}”.`}</Body>
      </PageScaffold>
    );
  }

  // Datos listos
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

              const formId = f.id_formulario;
              const versionId = f.version_vigente?.id_index_version ?? "";

              return (
                <FormListItem
                  key={formId}
                  title={f.nombre}
                  statusText={estado.texto}
                  statusColor={estado.color}
                  assignedAt={asignado}
                  availableUntil={disponibleHasta}
                  // ✅ Precarga robusta: debounce + memo + bundle + DB + datos
                  onPreload={() => requestPreloadWithDebounce(formId, versionId, 400)}
                  // Navega cuando termina la animación del item
                  onPress={() =>
                    router.push({
                      pathname: "/form/[formId]",
                      params: { formId, versionId },
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
