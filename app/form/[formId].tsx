// app/form/[formId].tsx
import { Body } from "@/components/atoms/Typography";
import PageScaffold from "@/components/templates/PageScaffold";
import { DB } from "@/db/sqlite";
import { Formulario } from "@/screens/FormPage";
import FormScreen from "@/screens/FormScreen"; // <- del canvas
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

export default function FormRoute() {
  const { formId, versionId } = useLocalSearchParams<{
    formId: string;
    versionId?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Formulario | null>(null);

  

  useEffect(() => {
    (async () => {
      try {
        const serverForm = await DB.selectFormFromGroupedById(formId as string);
        setForm(serverForm ? {
        id_formulario: serverForm.id_formulario,
        nombre: serverForm.nombre,
        paginas: serverForm.paginas.map(p => ({
            id_pagina: p.id_pagina,
            nombre: p.nombre,
            descripcion: p.descripcion ?? undefined,
            secuencia: p.secuencia ?? 0,
            campos: p.campos.map(c => ({
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
        } : null);
            } finally {
                setLoading(false);
            }
            })();
        }, [formId, versionId]);

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

  return <FormScreen form={form} />;
}

/* --- mapeos mínimos, ajusta a tus valores reales --- */
function mapTipo(t: any): "texto" | "booleano" | "numerico" | "imagen" {
  const s = String(t || "").toLowerCase();
  if (["bool", "booleano", "boolean"].includes(s)) return "booleano";
  if (["num", "numero", "numerico", "number"].includes(s)) return "numerico";
  if (["img", "image", "imagen", "firma", "firm"].includes(s)) return "imagen";
  return "texto";
}
function mapClase(c: any):
  | "string" | "text" | "list" | "dataset" | "hour" | "date"
  | "boolean" | "number" | "calc" | "firm" {
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
}
