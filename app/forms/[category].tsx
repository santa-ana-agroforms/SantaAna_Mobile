// app/forms/[category].tsx
import SkeletonLoader from "@/components/atoms/SkeletonLoader";
import { Body } from "@/components/atoms/Typography";
import FormListItem from "@/components/molecules/FormListItem";
import PageScaffold, { type ScaffoldDimensions } from "@/components/templates/PageScaffold";
import { DB } from "@/db/sqlite";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, InteractionManager, View } from "react-native";

import { sendFormEntry } from "@/api/client";
import InstanceSelector, { EntryPreview } from "@/components/molecules/InstanceSelector";
import {
  deleteLocalEntry,
  getJSONForm,
  initSessionFromSaved,
} from "@/forms/state/formSessionSlice";
import { useInstanceSelectorState } from "@/forms/state/useInstanceSelectorState";
import { useAppDispatch } from "@/store/hooks";
import { isOnline } from "@/utils/network";

import { getEntryById, markSynced } from "@/db/form-entries";

/** tipos locales */
type VersionVigente = { id_index_version: string; fecha_creacion: string };
type Formulario = { id_formulario: string; nombre: string; version_vigente: VersionVigente };
export type FormCategoryGroup = {
  nombre_categoria: string;
  descripcion: string | null;
  formularios: { id_formulario: string; nombre: string; version_vigente: VersionVigente }[];
};

/** helpers de estado/fecha (igual que tenías) */
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

/** preload (igual que tenías) */
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
      // opcional
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

const waitUntilSynced = async (
  sessionId: string,
  { timeout = 8000, interval = 150 }: { timeout?: number; interval?: number } = {}
) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const row = await getEntryById(sessionId);
      if (row?.status === "synced") return true;
    } catch {}
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
};

/** pantalla */
const FormsByCategoryScreen: React.FC = () => {
  const { category } = useLocalSearchParams<{ category: string }>();
  const [loading, setLoading] = useState(true);
  const [grupo, setGrupo] = useState<FormCategoryGroup | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalBusyText, setModalBusyText] = useState<string | null>(null);
  const {
    visible,
    entries,
    allowNew,
    periodLabel,
    openForForm,
    close,
    computeDecorators,
    refetch,
    optimisticMarkSubmitted, // ← importante
  } = useInstanceSelectorState();

  const [selectedForm, setSelectedForm] = useState<{
    formId: string;
    versionId: string;
    formName: string;
  } | null>(null);

  const dispatch = useAppDispatch();

  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "info" | "success" | "error"; text: string } | null>(
    null
  );

  const [countsByForm, setCountsByForm] = useState<
    Record<
      string,
      { draftCount: number; readyCount: number; submittedCount: number; periodLabel?: string }
    >
  >({});

  /** carga grupo + contadores */
  const loadLocal = useCallback(async (): Promise<FormCategoryGroup | null> => {
    const groups = await DB.selectFormsGroupedByCategory();
    const found = (groups ?? []).find((g) => g.nombre_categoria === category) ?? null;
    setGrupo(found);
    return found;
  }, [category]);

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
          const deco = await computeDecorators(formId, "daily");
          acc[formId] = deco;
        })
      );
      setCountsByForm(acc);
    },
    [computeDecorators]
  );

  const refreshScreen = useCallback(async () => {
    const freshGroup = await loadLocal();
    await recomputeCounts(freshGroup);
  }, [loadLocal, recomputeCounts]);

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

  useEffect(() => {
    return () => {
      for (const t of debounceTimers.values()) clearTimeout(t);
      debounceTimers.clear();
    };
  }, []);

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

  /** ✅ update optimista de los contadores de la tarjeta del formulario */
  const bumpCountsAfterSubmit = useCallback((formId: string) => {
    setCountsByForm((prev) => {
      const cur = prev[formId] ?? { draftCount: 0, readyCount: 0, submittedCount: 0 };
      // En InstanceSelector solo se puede enviar si estaba "ready_for_submit"
      const next = {
        ...cur,
        readyCount: Math.max(0, (cur.readyCount ?? 0) - 1),
        submittedCount: (cur.submittedCount ?? 0) + 1,
      };
      return { ...prev, [formId]: next };
    });
  }, []);

  const handleSubmitFromSelector = useCallback(
    async (entry: { id: string }) => {
      try {
        if (!(await isOnline())) {
          Alert.alert("Sin conexión", "Conéctate a Internet para enviar el formulario.");
          return;
        }
        if (!selectedForm) return;

        // 🔵 loader del botón + loader global del modal
        setSubmittingId(entry.id);
        setModalBusy(true);
        setModalBusyText("Enviando al servidor…");

        // 1) cargar sesión local
        await dispatch(initSessionFromSaved({ local_id: entry.id })).unwrap();

        // 2) envío remoto (mantén busy del modal durante todo este paso)
        const json = await dispatch(getJSONForm({ sessionId: entry.id })).unwrap();
        if (!json) throw new Error("No se pudo preparar el formulario para envío.");
        await sendFormEntry(json); // ← aquí sigue visible el loader global

        // 3) UI optimista en el modal
        optimisticMarkSubmitted(entry.id);
        bumpCountsAfterSubmit(selectedForm.formId);

        // 4) persiste en BD local y espera confirmación
        await markSynced(entry.id);
        const ok = await waitUntilSynced(entry.id, { timeout: 8000, interval: 150 });

        // 5) ya puedes soltar el spinner del botón, pero mantener el global si quieres más pasos
        setSubmittingId(null);
        setModalBusyText("Sincronizando datos locales…");

        if (ok) {
          await refetch();
          await refreshScreen();
          setBanner({ type: "success", text: "¡Formulario enviado!" });
        } else {
          setBanner({
            type: "info",
            text: "El envío fue exitoso, pero la sincronización local tardó más de lo esperado.",
          });
        }
      } catch (e: any) {
        setBanner({ type: "error", text: e?.message ?? "No se pudo enviar el formulario." });
      } finally {
        // 🔵 suelta el loader global al final
        setModalBusy(false);
        setModalBusyText(null);
      }
    },
    [dispatch, selectedForm, optimisticMarkSubmitted, bumpCountsAfterSubmit, refetch, refreshScreen]
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
  const handleDeleteEntry = async (entry: EntryPreview) => {
    dispatch(deleteLocalEntry({ local_id: entry.id }));
    await refetch();
    await refreshScreen();
  };

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
                      setSelectedForm({ formId, versionId, formName: f.nombre });
                      openForForm(formId); // abre modal y carga entries
                      setBanner(null); // limpia banner previo
                    }}
                    referenceFrame={referenceFrame}
                    contentFrame={contentFrame}
                    periodLabel={deco.periodLabel}
                    // En la tarjeta muestras drafts + ready como "En revisión"
                    readyCount={(deco.draftCount ?? 0) + (deco.readyCount ?? 0)}
                    submittedCount={deco.submittedCount ?? 0}
                  />
                );
              })}
            </View>

            <InstanceSelector
              visible={visible}
              periodLabel={periodLabel}
              formName={selectedForm?.formName ?? ""}
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
              onSubmit={handleSubmitFromSelector}
              onDelete={handleDeleteEntry}
              onClose={close}
              referenceFrame={referenceFrame}
              contentFrame={contentFrame}
              submittingId={submittingId}
              banner={banner}
              busy={modalBusy}
              busyText={modalBusyText ?? undefined}
            />
          </>
        );
      }}
    </PageScaffold>
  );
};

export default FormsByCategoryScreen;
