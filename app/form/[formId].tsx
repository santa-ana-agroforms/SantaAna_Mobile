import SkeletonLoader from "@/components/atoms/SkeletonLoader";
import { Body } from "@/components/atoms/Typography";
import PageScaffold from "@/components/templates/PageScaffold";
import { FormJSON, getEntryById, toFieldConfig } from "@/db/form-entries";
import { DB } from "@/db/sqlite";
import type { Formulario } from "@/screens/FormPage";
import FormScreen from "@/screens/FormScreen";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";

// Redux
import { sendFormEntry } from "@/api/client";
import FormStickyActions from "@/components/molecules/FormStickyActions";
import {
  getJSONForm,
  initSession,
  initSessionFromSaved,
  nextPage,
  persistCursorIndex,
  prevPage,
  selectCanGoNext,
  selectCanSendForReview,
  selectCurrentSession,
  selectCurrentSessionId,
  selectIsLastPage,
  setStatus,
} from "@/forms/state/formSessionSlice";
import { useFormPersistence } from "@/forms/state/useFormPersistence";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { isOnline } from "@/utils/network";

const FormRoute: React.FC = () => {
  const { formId, versionId, restored, entryId, mode } = useLocalSearchParams<{
    formId: string;
    versionId?: string;
    restored?: string;
    entryId?: string;
    mode?: "edit" | "review" | "view";
  }>();
  console.log("FormRoute params:", { formId, versionId, restored, entryId, mode });

  // Debounce util
  const useDebouncedSave = (saveFn: () => Promise<void>, delay = 600) => {
    const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const run = useCallback(() => {
      if (tRef.current) clearTimeout(tRef.current);
      tRef.current = setTimeout(() => {
        saveFn().catch(() => {});
      }, delay);
    }, [saveFn, delay]);
    useEffect(() => {
      return () => {
        if (tRef.current !== null) clearTimeout(tRef.current);
      };
    }, []);
    return run;
  };

  const dispatch = useAppDispatch();
  const { saveNow } = useFormPersistence();

  const sessionId = useAppSelector(selectCurrentSessionId);
  const currentSession = useAppSelector(selectCurrentSession);
  const isLastPage = useAppSelector((state) =>
    sessionId ? selectIsLastPage(sessionId)(state) : false
  );
  const canGoNext = useAppSelector((state) =>
    sessionId ? selectCanGoNext(sessionId)(state) : false
  );
  const canSendForReview = useAppSelector(
    sessionId ? selectCanSendForReview(sessionId) : () => false
  );

  const isReviewMode = mode === "review";

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Formulario | null>(null);

  const serverFormRef = useRef<FormJSON | null>(null);
  const [footerInfo, setFooterInfo] = useState<{
    type: "info" | "success" | "error";
    text: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  const [footerLoading, setFooterLoading] = useState(false);

  const handleHeaderBack = useCallback(async () => {
    try {
      await saveNow(); // guarda borrador + cursor
    } catch {}
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [saveNow]);

  const debouncedSave = useDebouncedSave(async () => {
    await saveNow();
  }, 500);

  const handlePrev = () => {
    if (!sessionId) return;
    dispatch(prevPage({ sessionId }));
    dispatch(persistCursorIndex({ sessionId })).finally(() => debouncedSave());
  };

  const handleNext = () => {
    if (!sessionId || !canGoNext) return;
    dispatch(nextPage({ sessionId }));
    dispatch(persistCursorIndex({ sessionId })).finally(() => debouncedSave());
  };

  const handlePageChange = useCallback(() => {
    if (!sessionId) return;
    dispatch(persistCursorIndex({ sessionId })).finally(() => debouncedSave());
  }, [dispatch, sessionId, debouncedSave]);

  /** Helpers de tiempo */
  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  /** Muestra éxito, espera, y navega a categoría */
  const showSuccessThenBack = useCallback(
    async (text: string, indicatorMs = 1500, afterMs = 1000) => {
      setFooterInfo({ type: "success", text }); // mostrar indicador
      await sleep(indicatorMs); // mantener visible
      setFooterInfo(null); // ocultar
      await sleep(afterMs); // esperar 1s extra
      if (router.canGoBack())
        router.back(); // regresar a la categoría
      else router.replace("/"); // fallback
    },
    []
  );

  /** Envío final (modo review) con loader + indicador + retorno */
  const sendOne = useCallback(async () => {
    const ctrl = new AbortController();
    console.log("[entries] Sending form entry for review...");
    try {
      if (!sessionId) {
        Alert.alert("Error", "No se pudo obtener la sesión.");
        return;
      }
      // Solo permitir en revisión cuando está listo
      const isReady = currentSession?.status === "ready_to_submit";
      if (!isReady) {
        Alert.alert("No listo", "El formulario no está listo para ser enviado.");
        return;
      }
      if (!(await isOnline())) {
        Alert.alert("Sin conexión", "Conéctate a Internet para enviar el formulario.");
        return;
      }

      setFooterLoading(true); // 🔄 loader ON

      // Asegura persistencia antes de construir el JSON
      await saveNow();

      const json = await dispatch(getJSONForm({ sessionId: sessionId as string })).unwrap();
      if (!json) {
        setFooterInfo({ type: "error", text: "No se pudo obtener el formulario." });
        return;
      }

      // 🚀 Envío real
      const resp = await sendFormEntry(json, { signal: ctrl.signal });
      console.log("[entries] server response:", resp);

      // Marca como enviado/sincronizado localmente
      await dispatch(setStatus({ sessionId, status: "synced" }));

      // ✅ indicador de éxito y regreso a categoría
      await showSuccessThenBack("¡Formulario enviado!");
    } catch (e: any) {
      setFooterInfo({ type: "error", text: e?.message ?? "No se pudo enviar el formulario." });
    } finally {
      setFooterLoading(false); // 🔄 loader OFF
    }
  }, [currentSession, dispatch, sessionId, showSuccessThenBack, saveNow]);

  // Cargar form (desde saved o server)
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (entryId) {
          await dispatch(initSessionFromSaved({ local_id: entryId })).unwrap();
          const saved = await getEntryById(entryId);
          if (saved) {
            const savedForm = saved.form_json as FormJSON;
            serverFormRef.current = savedForm;

            setForm({
              id_formulario: savedForm.id_formulario,
              nombre: savedForm.nombre,
              paginas: savedForm.paginas.map((p) => ({
                id_pagina: p.id_pagina,
                nombre: p.nombre,
                descripcion: p.descripcion ?? undefined,
                secuencia: p.secuencia === null ? 0 : (p.secuencia ?? 0),
                campos: p.campos.map((c) => ({
                  id_campo: c.id_campo,
                  sequence: c.sequence,
                  tipo: mapTipo(c.tipo),
                  clase: mapClase(c.clase),
                  nombre_interno: c.nombre_interno,
                  etiqueta: c.etiqueta ?? "",
                  ayuda: c.ayuda ?? undefined,
                  config: toFieldConfig(c.config),
                  requerido: !!c.requerido,
                })),
              })),
            });
            setLoading(false);
            return;
          }
        }

        const serverForm = await DB.selectFormFromGroupedById(formId as string);
        if (serverForm) {
          console.log("Cargando form desde server:", JSON.stringify(serverForm, null, 2));
          const fixedSessionForm: FormJSON = {
            id_formulario: serverForm.id_formulario,
            nombre: serverForm.nombre,
            version_vigente: {
              id_index_version: serverForm.version_vigente.id_index_version,
              fecha_creacion: serverForm.version_vigente.fecha_creacion,
            },
            paginas: serverForm.paginas.map((p) => ({
              id_pagina: p.id_pagina,
              nombre: p.nombre,
              descripcion: p.descripcion ?? undefined,
              secuencia: p.secuencia ?? undefined,
              pagina_version: {
                id: p.pagina_version.id,
                fecha_creacion: p.pagina_version.fecha_creacion,
              },
              campos: p.campos.map((c) => ({
                id_campo: c.id_campo,
                sequence: c.sequence,
                tipo: mapTipo(c.tipo),
                clase: mapClase(c.clase),
                nombre_interno: c.nombre_interno,
                etiqueta: c.etiqueta ?? "",
                ayuda: c.ayuda ?? undefined,
                config: toFieldConfig(c.config),
                requerido: !!c.requerido,
              })),
            })),
          };

          serverFormRef.current = fixedSessionForm;
          await dispatch(initSession({ form: fixedSessionForm })).unwrap();

          setForm({
            id_formulario: serverForm.id_formulario,
            nombre: serverForm.nombre,
            paginas: serverForm.paginas.map((p) => ({
              id_pagina: p.id_pagina,
              nombre: p.nombre,
              descripcion: p.descripcion ?? undefined,
              secuencia: p.secuencia === null ? 0 : (p.secuencia ?? 0),
              campos: p.campos.map((c) => ({
                id_campo: c.id_campo,
                sequence: c.sequence,
                tipo: mapTipo(c.tipo),
                clase: mapClase(c.clase),
                nombre_interno: c.nombre_interno,
                etiqueta: c.etiqueta ?? "",
                ayuda: c.ayuda ?? undefined,
                config: c.config ?? undefined,
                requerido: !!c.requerido,
              })),
            })),
          });
        } else {
          setForm(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [dispatch, formId, versionId, restored, entryId]);

  const pagesCount = form?.paginas.length ?? 0;
  const currentPage = currentSession?.currentPageIndex ?? 0;

  if (loading) {
    return (
      <PageScaffold
        title="Cargando…"
        variant="form"
        page={currentPage + 1}
        totalPages={pagesCount}
        onPrevPage={handlePrev}
        onNextPage={handleNext}
        onBack={handleHeaderBack}
      >
        {({ referenceFrame, contentFrame }) => {
          const gapY = contentFrame.height * 0.02;
          const items = Array.from({ length: 10 });
          return (
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
              <View style={{ alignItems: "flex-end", marginBottom: gapY }}>
                <View style={{ width: referenceFrame.width * 0.35 }}>
                  <SkeletonLoader preset="button" frame={referenceFrame} />
                </View>
              </View>
              <View style={{ gap: gapY }}>
                {items.map((_, i) => (
                  <View key={i} style={{ gap: referenceFrame.height * 0.008 }}>
                    <View style={{ width: "70%" }}>
                      <SkeletonLoader preset="title" frame={referenceFrame} />
                    </View>
                    <SkeletonLoader
                      preset="card"
                      frame={referenceFrame}
                      height={referenceFrame.height * 0.08}
                    />
                  </View>
                ))}
              </View>
            </View>
          );
        }}
      </PageScaffold>
    );
  }

  if (!form) {
    return (
      <PageScaffold title="Formulario" variant="form">
        <Body>No se pudo cargar el formulario.</Body>
      </PageScaffold>
    );
  }

  /** Envío a revisión (modo normal) con loader + indicador + retorno */
  const handleSendForReview = async () => {
    if (!sessionId) return;
    if (!canSendForReview) {
      setFooterInfo({ type: "error", text: "Faltan campos requeridos para enviar a revisión." });
      return;
    }
    try {
      setFooterLoading(true); // 🔄 loader ON
      await saveNow(); // persiste fill_json + cursor
      await showSuccessThenBack("¡Enviado a revisión!");
    } catch {
      setFooterInfo({ type: "error", text: "No se pudo enviar. Intenta nuevamente." });
    } finally {
      setFooterLoading(false); // 🔄 loader OFF
    }
  };

  // Lógica de botón principal (label/habilitación/handler)
  // const disabledPrimary = isReviewMode ? !(canSendForReview && isLastPage) : !canSendForReview;
  // const primaryLabel = isReviewMode ? "Enviar" : "Enviar a revisión";
  // const onPrimary = isReviewMode ? sendOne : handleSendForReview;

  // console.log(
  //   "[UI] reviewMode:",
  //   isReviewMode,
  //   "isLastPage:",
  //   isLastPage,
  //   "canSendForReview:",
  //   canSendForReview,
  //   "disabledPrimary:",
  //   isReviewMode ? !(canSendForReview && isLastPage) : !canSendForReview
  // );

  const isViewMode = mode === "view";

  // Considera enviados/sincronizados como solo lectura
  const isSubmittedLike = ["synced", "submitted"].includes(currentSession?.status ?? "");

  // Flag final de solo-lectura
  const isReadonly = isViewMode || isSubmittedLike;

  return (
    <PageScaffold
      title={form.nombre}
      variant="form"
      page={currentPage + 1}
      totalPages={pagesCount}
      onPrevPage={handlePrev}
      onNextPage={handleNext}
      canNext={!canGoNext}
    >
      {({ referenceFrame, contentFrame, layoutFrame }) => (
        <View style={{ flex: 1 }}>
          <FormScreen
            form={form}
            referenceFrame={referenceFrame}
            contentFrame={contentFrame}
            layoutFrame={layoutFrame}
            page={currentPage}
            onPageChange={handlePageChange}
          />
          {!isReadonly && (
            <FormStickyActions
              referenceFrame={referenceFrame}
              contentFrame={contentFrame}
              disabledSend={isReviewMode ? !(canSendForReview && isLastPage) : !canSendForReview}
              loading={footerLoading}
              infoMessage={footerInfo}
              onSendForReview={isReviewMode ? sendOne : handleSendForReview}
              sendLabel={isReviewMode ? "Enviar" : "Enviar a revisión"}
            />
          )}
        </View>
      )}
    </PageScaffold>
  );
};

export default FormRoute;

/* --- mapeos mínimos, igual que tu versión --- */
const mapTipo = (t: any): "texto" | "booleano" | "numerico" | "imagen" => {
  const s = String(t || "").toLowerCase();
  if (["bool", "booleano", "boolean"].includes(s)) return "booleano";
  if (["num", "numero", "numerico", "number"].includes(s)) return "numerico";
  if (["img", "image", "imagen", "firma", "firm"].includes(s)) return "imagen";
  return "texto";
};

const mapClase = (
  c: any
):
  | "string"
  | "text"
  | "list"
  | "dataset"
  | "hour"
  | "date"
  | "boolean"
  | "number"
  | "calc"
  | "firm" => {
  const s = String(c || "").toLowerCase();
  if (["lista", "list"].includes(s)) return "list";
  if (["dataset", "fuente"].includes(s)) return "dataset";
  if (["hora", "hour", "time"].includes(s)) return "hour";
  if (["fecha", "date"].includes(s)) return "date";
  if (["boolean", "booleano"].includes(s)) return "boolean";
  if (["numero", "number", "num"].includes(s)) return "number";
  if (["calc", "calculado"].includes(s)) return "calc";
  if (["firma", "firm", "signature"].includes(s)) return "firm";
  if (["text", "textarea"].includes(s)) return "text";
  return "string";
};
