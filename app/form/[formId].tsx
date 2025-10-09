// app/form/[formId].tsx
import { Body } from "@/components/atoms/Typography";
import PageScaffold from "@/components/templates/PageScaffold";
import { FormJSON, toFieldConfig } from "@/db/form-entries";
import { DB } from "@/db/sqlite";
import type { Formulario } from "@/screens/FormPage"; // tipado esperado por FormScreen
import FormScreen from "@/screens/FormScreen"; // tu pantalla de formulario
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";

// ⬇️ Redux slice real
import {
  goToPage,
  initSession,
  nextPage,
  prevPage,
  selectCanGoNext,
  selectCurrentSession,
  selectCurrentSessionId,
} from "@/forms/state/formSessionSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const FormRoute: React.FC = () => {
  const { formId, versionId } = useLocalSearchParams<{
    formId: string;
    versionId?: string;
  }>();

  const dispatch = useAppDispatch();
  const sessionId = useAppSelector(selectCurrentSessionId);
  const currentSession = useAppSelector(selectCurrentSession);
  const canGoNext = useAppSelector(sessionId ? selectCanGoNext(sessionId) : () => false);

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Formulario | null>(null);

  const serverFormRef = useRef<FormJSON | null>(null);

  useEffect(() => {
    (async () => {
      try {
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
          // ⬇️ Inicializa la sesión en el slice (establece currentSessionId internamente)
          await dispatch(initSession({ form: fixedSessionForm }));
        }

        setForm(
          serverForm
            ? {
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
              }
            : null
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [dispatch, formId, versionId]);

  const pagesCount = form?.paginas.length ?? 0;
  const currentPage = currentSession?.currentPageIndex ?? 0;

  const handlePrev = () => {
    if (!sessionId) return;
    dispatch(prevPage({ sessionId }));
  };

  const handleNext = () => {
    if (!sessionId) return;
    if (!canGoNext) return;
    dispatch(nextPage({ sessionId }));
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
        <FormScreen
          form={form}
          referenceFrame={referenceFrame}
          contentFrame={contentFrame}
          layoutFrame={layoutFrame}
          page={currentPage}
        />
      )}
    </PageScaffold>
  );
};

export default FormRoute;

/* --- mapeos mínimos, ajusta a tus valores reales --- */
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
