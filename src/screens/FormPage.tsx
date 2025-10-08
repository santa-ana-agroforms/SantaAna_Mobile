// ============================================
// src/components/forms/FormPage.tsx
// Página vertical scrolleable que pinta cada campo con FieldRenderer
// ============================================
import { Body } from "@/components/atoms/Typography";
import { FormSession } from "@/forms/runtime/FormSession";
import React, { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import FieldRenderer from "./FieldRenderer";

export type Campo = {
  id_campo: string;
  sequence: number;
  tipo: "texto" | "booleano" | "numerico" | "imagen";
  clase: string; // string | text | list | dataset | hour | date | boolean | number | calc | firm
  nombre_interno: string;
  etiqueta: string;
  ayuda?: string;
  config?: any;
  requerido: boolean;
};

export type Pagina = {
  id_pagina: string;
  secuencia: number;
  nombre: string;
  descripcion?: string;
  campos: Campo[];
};

export type Formulario = {
  id_formulario: string;
  nombre: string;
  paginas: Pagina[];
};

type Frame = { width: number; height: number };

type Props = {
  page: Pagina;
  formName?: string;
  referenceFrame: Frame; // escala tipográfica/geométrica
  contentFrame: Frame; // ancho/alto útil del body
  formSession: FormSession; // sesión del formulario (para guardar/leer valores)
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Comparador para arrays de entradas de grupo (id + values shallow) */
const shallowEqualGroupEntries = (a: any, b: any) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ea = a[i],
      eb = b[i];
    if (!ea || !eb) return false;
    if (ea.id !== eb.id) return false;
    const ka = Object.keys(ea.values || {});
    const kb = Object.keys(eb.values || {});
    if (ka.length !== kb.length) return false;
    for (const k of ka) {
      if (!Object.is(ea.values[k], eb.values[k])) return false;
    }
  }
  return true;
};

/** Igualdad “segura” para evitar writes redundantes a la sesión */
const isSameValue = (prev: any, next: any) => {
  if (Object.is(prev, next)) return true;
  if (Array.isArray(prev) && Array.isArray(next)) {
    // típico para grupos o listas de objetos
    return shallowEqualGroupEntries(prev, next);
  }
  // si quieres ampliar para objetos planos, puedes agregar un shallowEqual aquí
  return false;
};

const FormPageView: React.FC<Props> = ({
  page,
  formName,
  referenceFrame,
  contentFrame,
  formSession,
}) => {
  // Índice de esta página dentro del formulario (para leer/escribir correctamente en la sesión)
  const pageIndex = useMemo(
    () => formSession.form.paginas.findIndex((p) => p.id_pagina === page.id_pagina),
    [formSession.form.paginas, page.id_pagina]
  );

  // Tick para forzar re-lectura desde la sesión tras escribir (evita estados duplicados)
  const [sessionVer, setSessionVer] = useState(0);

  // Handler único: escribe en la sesión SOLO si cambia el valor, y bump del tick
  const handleChangeValue = useCallback(
    (name: string, value: unknown) => {
      const idx = pageIndex >= 0 ? pageIndex : undefined;
      const prev = formSession.getFieldValue(name, idx);

      if (isSameValue(prev, value)) {
        // No hay cambio real → no escribas ni bump
        return;
      }

      formSession.setFieldValue(name, value, idx);
      setSessionVer((v) => v + 1);
    },
    [formSession, pageIndex]
  );

  // Ordena campos una sola vez por 'sequence'
  const fields = useMemo(
    () => [...(page?.campos || [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)),
    [page?.campos]
  );

  const minSide = Math.min(referenceFrame.width, referenceFrame.height);
  const padBottom = clamp(minSide * 0.02, 12, 24);
  const headerGap = clamp(minSide * 0.012, 8, 16);
  const fieldGap = clamp(minSide * 0.016, 10, 22);

  return (
    <View style={{ paddingRight: 0, paddingBottom: padBottom * 0 }}>
      <Body weight="bold" size="xl">
        {page?.nombre}
      </Body>

      {page?.descripcion ? (
        <Body frame={referenceFrame} color="secondary" size="sm">
          {page.descripcion}
        </Body>
      ) : null}

      <View style={{ height: headerGap }} />

      {fields.map((f) => (
        <View key={f.id_campo} style={{ marginBottom: fieldGap }}>
          <FieldRenderer
            campo={f}
            formName={formName}
            referenceFrame={referenceFrame}
            contentFrame={contentFrame}
            formSession={formSession}
            // Props para sincronizar correctamente
            pageIndex={pageIndex}
            sessionVer={sessionVer}
            onChangeValue={handleChangeValue}
          />
        </View>
      ))}

      <View style={{ height: padBottom * 0 }} />
    </View>
  );
};

export default FormPageView;
