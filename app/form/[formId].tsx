// app/form/[formId].tsx
import { Body } from "@/components/atoms/Typography";
import PageScaffold from "@/components/templates/PageScaffold";
import { FormJSON, toFieldConfig } from "@/db/form-entries";
import { DB } from "@/db/sqlite";
import { FormSession } from "@/forms/runtime/FormSession";
import type { Formulario } from "@/screens/FormPage"; // tipado esperado por FormScreen
import FormScreen from "@/screens/FormScreen"; // tu pantalla de formulario
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";

const FormRoute: React.FC = () => {
  const { formId, versionId } = useLocalSearchParams<{
    formId: string;
    versionId?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Formulario | null>(null);
  const [page, setPage] = useState(0);
  const pagesCount = form?.paginas.length ?? 0;

  const serverFormRef = useRef<FormJSON | null>(null);

  // ⬇️⬇️ CAMBIO: sesión del formulario
  const sessionRef = useRef<FormSession | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const serverForm = await DB.selectFormFromGroupedById(formId as string);
        if (serverForm) {
          // 🔧 Construir un FormJSON válido para la sesión (null -> undefined, mapTipo/mapClase, etc.)
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
              // 👇 null -> undefined para calzar con Pagina.descripcion?: string
              descripcion: p.descripcion ?? undefined,
              // 👇 si viene null, que sea undefined (opcional)
              secuencia: p.secuencia ?? undefined,
              pagina_version: {
                id: p.pagina_version.id,
                fecha_creacion: p.pagina_version.fecha_creacion,
              },
              // 👇 mapear ServerField -> Campo (y normalizar tipo/clase)
              campos: p.campos.map((c) => ({
                id_campo: c.id_campo,
                sequence: c.sequence,
                tipo: mapTipo(c.tipo), // "texto" | "numerico" | "booleano" | "imagen"
                clase: mapClase(c.clase), // "string" | "list" | "date" | "number" | "calc" | "boolean" | "firm" | ...
                nombre_interno: c.nombre_interno,
                etiqueta: c.etiqueta ?? "", // etiqueta es requerida en FormSession.Campo
                ayuda: c.ayuda ?? undefined, // null -> undefined
                config: toFieldConfig(c.config),
                requerido: !!c.requerido,
              })),
            })),
          };

          // 👉 Usar SIEMPRE este objeto para la sesión:
          serverFormRef.current = fixedSessionForm;
          sessionRef.current = new FormSession(fixedSessionForm);
          sessionRef.current.closeAndPersist(); // crea un draft inicial
        }

        // Tu shape para la UI (Formulario) lo podés dejar igual:
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

        // Arranque en pág 0 para sesión y UI
        setPage(0);
        sessionRef.current?.goToPage(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [formId, versionId]);

  // ⬇️⬇️ CAMBIO: handlers de navegación que consultan la sesión
  const handlePrev = () => {
    const s = sessionRef.current;
    if (!s) {
      setPage((p) => Math.max(0, p - 1));
      return;
    }
    const before = s.getCurrentPageIndex();
    s.prevPage();
    const after = s.getCurrentPageIndex();
    if (after !== before) setPage(after);
  };

  const handleNext = () => {
    const s = sessionRef.current;
    if (!s) {
      // Fallback: comportamiento anterior
      setPage((p) => Math.min(pagesCount - 1, p + 1));
      return;
    }
    // Solo avanzar si la página actual cumple requeridos
    if (!s.canGoNext()) {
      // Aquí podrías disparar un toast o UI de errores si querés
      return;
    }
    const before = s.getCurrentPageIndex();
    s.nextPage();
    const after = s.getCurrentPageIndex();
    if (after !== before) setPage(after);
  };

  // (Opcional) estado de si se puede avanzar; útil para deshabilitar el botón "Siguiente"
  const canNext = useMemo(() => {
    const s = sessionRef.current;
    if (!s) return page < pagesCount - 1;
    return s.canGoNext() && s.getCurrentPageIndex() < s.getPageCount() - 1;
  }, [page, pagesCount]);

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
      page={page + 1}
      totalPages={pagesCount}
      onPrevPage={handlePrev} // ⬅️ CAMBIO
      onNextPage={handleNext} // ⬅️ CAMBIO
      canNext={!canNext} // ⬅️ (opcional) deshabilitar si no cumple requeridos
    >
      {({ referenceFrame, contentFrame, layoutFrame }) => (
        <FormScreen
          form={form}
          referenceFrame={referenceFrame}
          contentFrame={contentFrame}
          layoutFrame={layoutFrame}
          page={page} // controlado
          onPageChange={(idx) => {
            // ⬇️⬇️ CAMBIO: si cambian via dots, sincronizamos sesión
            sessionRef.current?.goToPage(idx);
            setPage(idx);
          }}
          formSession={sessionRef.current as FormSession} // nunca null acá
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
