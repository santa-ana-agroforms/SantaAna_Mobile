// app/form/[formId].tsx
import { Body } from "@/components/atoms/Typography";
import PageScaffold from "@/components/templates/PageScaffold";
import { FormJSON, getEntryById, toFieldConfig } from "@/db/form-entries";
import { DB } from "@/db/sqlite";
import type { Formulario } from "@/screens/FormPage";
import FormScreen from "@/screens/FormScreen";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

// Redux
import {
  initSession,
  initSessionFromSaved,
  nextPage,
  persistCursorIndex,
  prevPage,
  selectCanGoNext,
  selectCurrentSession,
  selectCurrentSessionId,
} from "@/forms/state/formSessionSlice";
import { useFormPersistence } from "@/forms/state/useFormPersistence";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

// ────────────────────────────────────────────────────────────────────────────

const FormRoute: React.FC = () => {
  const { formId, versionId, restored } = useLocalSearchParams<{
    formId: string;
    versionId?: string;
    restored?: string; // abre desde guardado local (reanuda página)
  }>();

  const dispatch = useAppDispatch();
  const { saveNow } = useFormPersistence();

  const sessionId = useAppSelector(selectCurrentSessionId);
  const currentSession = useAppSelector(selectCurrentSession);
  const canGoNext = useAppSelector(sessionId ? selectCanGoNext(sessionId) : () => false);

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Formulario | null>(null);

  const serverFormRef = useRef<FormJSON | null>(null);

  // Cargar form (desde saved o desde server)
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (restored) {
          await dispatch(initSessionFromSaved({ local_id: restored })).unwrap();
          const saved = await getEntryById(restored);
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

        // Flujo normal: traer del server y crear sesión nueva
        const serverForm = await DB.selectFormFromGroupedById(formId as string);
        if (serverForm) {
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
  }, [dispatch, formId, versionId, restored]);

  const pagesCount = form?.paginas.length ?? 0;
  const currentPage = currentSession?.currentPageIndex ?? 0;

  const handlePrev = () => {
    if (!sessionId) return;
    dispatch(prevPage({ sessionId }));
    // guardá cursor ligero
    dispatch(persistCursorIndex({ sessionId })).catch(() => {});
  };

  const handleNext = () => {
    if (!sessionId) return;
    if (!canGoNext) return;
    dispatch(nextPage({ sessionId }));
    // guardá cursor ligero
    dispatch(persistCursorIndex({ sessionId })).catch(() => {});
  };

  // NUEVO: callback cuando el pager cambia (swipe o tap en tabs)
  const handlePageChange = useCallback(() => {
    if (!sessionId) return;
    // ya se actualiza currentPageIndex vía goToPage en FormScreen,
    // acá solo persistimos el cursor
    dispatch(persistCursorIndex({ sessionId })).catch(() => {});
  }, [dispatch, sessionId]);

  const handleSaveLocal = async () => {
    try {
      const sid = await saveNow();
      console.log("Guardado local:", sid);
    } catch (e) {
      console.warn("Error al guardar:", e);
    }
  };

  if (loading) {
    return (
      <PageScaffold title="Cargando…" variant="form">
        <Body>Cargando formulario…</Body>
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
          {/* Barra simple para guardar local */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <TouchableOpacity
              onPress={handleSaveLocal}
              style={{
                alignSelf: "flex-end",
                backgroundColor: "#0A84FF",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
              }}
            >
              <Text allowFontScaling={false} style={{ color: "white", fontWeight: "700" }}>
                Guardar local
              </Text>
            </TouchableOpacity>
          </View>

          <FormScreen
            form={form}
            referenceFrame={referenceFrame}
            contentFrame={contentFrame}
            layoutFrame={layoutFrame}
            page={currentPage}
            onPageChange={handlePageChange} // 👈 NUEVO: persistir cursor al cambiar
          />
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
