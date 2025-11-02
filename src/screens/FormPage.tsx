import { Body } from "@/components/atoms/Typography";
import React, { useMemo } from "react";
import { View } from "react-native";
import FieldRenderer from "./FieldRenderer";

// ⬇️ Redux
import { selectCurrentSessionId, setFieldValue } from "@/forms/state/formSessionSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

export type Campo = {
  id_campo: string;
  sequence: number;
  tipo: "texto" | "booleano" | "numerico" | "imagen" | "group";
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
  mode?: "edit" | "review" | "view";
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const FormPageView: React.FC<Props> = ({ page, formName, referenceFrame, contentFrame, mode }) => {
  const dispatch = useAppDispatch();
  const sessionId = useAppSelector(selectCurrentSessionId);

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
    <View style={{ paddingRight: 0, paddingBottom: padBottom * 1.1 }}>
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
            // key={f.id_campo}
            campo={f}
            formName={formName}
            referenceFrame={referenceFrame}
            contentFrame={contentFrame}
            // Interceptar (opcional) además de persistir en slice:
            onChangeValue={(name, value) =>
              sessionId && dispatch(setFieldValue({ sessionId, nombreInterno: name, value }))
            }
            mode={mode}
          />
        </View>
      ))}

      <View style={{ height: padBottom * 0 }} />
    </View>
  );
};

export default FormPageView;
