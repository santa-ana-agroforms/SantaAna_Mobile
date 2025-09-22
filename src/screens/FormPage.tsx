// ============================================
// src/components/forms/FormPage.tsx
// Página verticalmente scrolleable que pinta cada campo con FieldRenderer
// ============================================
import React from "react";
import { ScrollView, View } from "react-native";
import { useResponsive } from "@/hooks/useResponsive";
import { Title, Body } from "@/components/atoms/Typography";
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

export default function FormPageView({ page, formName }: { page: Pagina; formName?: string }) {
  const { gutter } = useResponsive();
  const fields = [...(page?.campos || [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

  return (
    <ScrollView
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: gutter * 2, paddingBottom: gutter * 2 }}
    >
      <View style={{ height: gutter * 0.75 }} />
      <Title>{page?.nombre}</Title>
      {page?.descripcion ? <Body color="secondary">{page.descripcion}</Body> : null}
      <View style={{ height: gutter }} />

      {fields.map((f) => (
        <View key={f.id_campo} style={{ marginBottom: gutter * 1.25 }}>
          <FieldRenderer campo={f} formName={formName} />
        </View>
      ))}

      <View style={{ height: gutter * 2 }} />
    </ScrollView>
  );
}
