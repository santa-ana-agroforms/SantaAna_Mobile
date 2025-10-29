// app/forms/[category].tsx
import SkeletonLoader from "@/components/atoms/SkeletonLoader";
import { Body } from "@/components/atoms/Typography";
import FormListItem from "@/components/molecules/FormListItem";
import PageScaffold, { type ScaffoldDimensions } from "@/components/templates/PageScaffold";
import { DB } from "@/db/sqlite";
import { useFocusEffect } from "@react-navigation/native"; // ⬅️ NUEVO
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { InteractionManager, View } from "react-native";

// NEW: selector + hook de estado visual
import InstanceSelector from "@/components/molecules/InstanceSelector";
import { useInstanceSelectorState } from "@/forms/state/useInstanceSelectorState";

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

/** -----------------------------------------
 * Helpers de estado/fecha (se mantienen)
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
 * PRELOAD local (igual que antes)
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

const preloadMap = new Map<string, Promise<void>>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

const ensureWarmDb = async () => {
  try {
    await DB.ensureMigrated();
    await DB.logDbCounts();
  } catch {}
};

const preloadFormScreenAndData = async (formId: string, versionId: string) => {
  const key = `${formId}:${versionId}`;
  if (preloadMap.has(key)) return preloadMap.get(key)!;

  const p = (async () => {
    try {
      await Promise.all([import("app/form/[formId]"), import("@/screens/FormPage")]);
    } catch {}
    await ensureWarmDb();

    const form = await DB.selectFormFromGroupedById(formId);
    if (!form) return;

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

    InteractionManager.runAfterInteractions(() => {
      // precarga opcional de assets
    });
  })();

  preloadMap.set(key, p);
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

  const { visible, entries, allowNew, periodLabel, openForForm, close, computeDecorators } =
    useInstanceSelectorState();
  const [selectedForm, setSelectedForm] = useState<{ formId: string; versionId: string } | null>(
    null
  );

  const [countsByForm, setCountsByForm] = useState<
    Record<
      string,
      {
        draftCount: number;
        readyCount: number;
        submittedCount: number;
        periodLabel?: string;
      }
    >
  >({});

  /** Carga el grupo actual y lo retorna */
  const loadLocal = useCallback(async (): Promise<FormCategoryGroup | null> => {
    const groups = await DB.selectFormsGroupedByCategory();
    const found = (groups ?? []).find((g) => g.nombre_categoria === category) ?? null;
    setGrupo(found);
    return found;
  }, [category]);

  /** Recalcula contadores para todos los formularios del grupo dado */
  const recomputeCounts = useCallback(
    async (targetGroup: FormCategoryGroup | null) => {
      if (!targetGroup?.formularios?.length) {
        setCountsByForm({});
        return;
      }
      const acc: Record<string, any> = {};
      await Promise.all(
        targetGroup.formularios.map(async (f) => {
          const formId = f.id_formulario;
          const deco = await computeDecorators(formId, "daily"); // mismo periodo que muestras
          acc[formId] = deco;
        })
      );
      setCountsByForm(acc);
    },
    [computeDecorators]
  );

  /** Hace reload del grupo y luego recomputa los contadores */
  const refreshScreen = useCallback(async () => {
    const freshGroup = await loadLocal();
    await recomputeCounts(freshGroup);
  }, [loadLocal, recomputeCounts]);

  // Primer load (skeletons, etc.)
  useEffect(() => {
    (async () => {
      try {
        const fresh = await loadLocal();
        await recomputeCounts(fresh);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadLocal, recomputeCounts]);

  // Limpieza de debounces
  useEffect(() => {
    return () => {
      for (const t of debounceTimers.values()) clearTimeout(t);
      debounceTimers.clear();
    };
  }, []);

  // ⬇️ Refresco cada vez que la pantalla gana foco
  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      (async () => {
        if (!active) return;
        await refreshScreen();
      })();
      return () => {
        active = false;
      };
    }, [refreshScreen])
  );

  const headerTitle = String(category);

  if (loading && !grupo) {
    return (
      <PageScaffold title={headerTitle} variant="groups">
        {({ referenceFrame, contentFrame }: ScaffoldDimensions) => {
          const gapY = Math.max(Math.min(contentFrame.width * 0.04, 24), 12);
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

  return (
    <PageScaffold title={headerTitle} variant="groups">
      {({ contentFrame, referenceFrame }: ScaffoldDimensions) => {
        const gapY = Math.max(Math.min(contentFrame.width * 0.04, 24), 12);

        const goNew = (formId: string, versionId: string) => {
          router.push({ pathname: "/form/[formId]", params: { formId, versionId, mode: "edit" } });
        };
        const goOpen = (
          formId: string,
          versionId: string,
          entryId: string,
          mode: "edit" | "review" | "view"
        ) => {
          router.push({ pathname: "/form/[formId]", params: { formId, versionId, entryId, mode } });
        };

        return (
          <>
            <View style={{ gap: gapY }}>
              {grupo!.formularios.map((f) => {
                const estado = getEstado(f);
                const asignado = f.version_vigente?.fecha_creacion
                  ? new Date(f.version_vigente.fecha_creacion)
                  : null;
                const disponibleHasta = getFechaDisponibleHasta(asignado);

                const formId = f.id_formulario;
                const versionId = f.version_vigente?.id_index_version ?? "";
                const deco = countsByForm[formId] ?? {};
                return (
                  <FormListItem
                    key={formId}
                    title={f.nombre}
                    statusText={estado.texto}
                    statusColor={estado.color}
                    assignedAt={asignado}
                    availableUntil={disponibleHasta}
                    onPreload={() => requestPreloadWithDebounce(formId, versionId, 400)}
                    onPress={() => {
                      setSelectedForm({ formId, versionId });
                      openForForm(formId);
                    }}
                    referenceFrame={referenceFrame}
                    contentFrame={contentFrame}
                    periodLabel={deco.periodLabel}
                    draftCount={deco.draftCount ?? 0}
                    readyCount={deco.readyCount ?? 0}
                    submittedCount={deco.submittedCount ?? 0}
                  />
                );
              })}
            </View>

            <InstanceSelector
              visible={visible}
              periodLabel={periodLabel}
              entries={entries}
              allowNew={allowNew}
              onNew={() => {
                if (!selectedForm) return;
                goNew(selectedForm.formId, selectedForm.versionId);
              }}
              onOpen={(entry, mode) => {
                if (!selectedForm) return;
                goOpen(selectedForm.formId, selectedForm.versionId, entry.id, mode);
              }}
              onClose={close}
              referenceFrame={referenceFrame}
              contentFrame={contentFrame}
            />
          </>
        );
      }}
    </PageScaffold>
  );
};

export default FormsByCategoryScreen;
