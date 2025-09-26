// src/screens/FormScreen.tsx
import { FormSession } from "@/forms/runtime/FormSession";
import { colors } from "@/theme/tokens";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import PagerView, { type PagerViewOnPageSelectedEvent } from "react-native-pager-view";
import FormPageView, { type Formulario, type Pagina } from "./FormPage";

type Frame = { width: number; height: number };

type Props = {
  form: Formulario;
  referenceFrame: Frame;
  contentFrame: Frame; // área útil debajo del header
  layoutFrame: Frame;
  page?: number;
  onPageChange?: (index: number) => void;
  formSession: FormSession;
};

const FormScreen: React.FC<Props> = ({
  form,
  referenceFrame,
  contentFrame,
  page,
  onPageChange,
  formSession,
}) => {
  const rawPages = useMemo(() => form?.paginas ?? [], [form?.paginas]);

  // Congela/ordena páginas
  const pagesRef = useRef<Pagina[]>([]);
  const [pagesVersion, setPagesVersion] = useState(0);
  useEffect(() => {
    const sorted = rawPages.slice().sort((a, b) => (a.secuencia ?? 0) - (b.secuencia ?? 0));
    pagesRef.current = sorted;
    setPagesVersion((v) => v + 1);
  }, [form?.id_formulario, rawPages]);

  const pages = pagesRef.current;
  const pagesCount = pages.length;

  // Controlado vs no controlado
  const isControlled = typeof page === "number";
  const [uPage, setUPage] = useState(0);
  const curPage = isControlled ? (page as number) : uPage;

  const pagerRef = useRef<PagerView>(null);
  const pageRef = useRef(curPage);
  pageRef.current = curPage;

  const W = Math.max(1, Math.round(referenceFrame.width || 1));
  const H = Math.max(1, Math.round(referenceFrame.height || 1));
  const padX = referenceFrame.width * 0.04;

  // Reset al cambiar form
  useEffect(() => {
    if (!pagesCount) return;
    if (!isControlled) setUPage(0);
    requestAnimationFrame(() => pagerRef.current?.setPageWithoutAnimation(0));
  }, [form?.id_formulario, pagesCount, isControlled]);

  // Sincroniza cuando cambia 'page' controlado
  useEffect(() => {
    if (!isControlled || pagesCount === 0) return;
    const target = Math.max(0, Math.min(pagesCount - 1, page ?? 0));
    requestAnimationFrame(() => pagerRef.current?.setPageWithoutAnimation(target));
  }, [isControlled, pagesCount, page]);

  // Re-centrar al cambiar tamaño
  useEffect(() => {
    if (!pagesCount) return;
    requestAnimationFrame(() => pagerRef.current?.setPageWithoutAnimation(pageRef.current));
  }, [W, H, pagesCount, pagesVersion]);

  const emitPageChange = (next: number) => {
    if (!isControlled) setUPage(next);
    onPageChange?.(next);
  };

  const onSelected = (e: PagerViewOnPageSelectedEvent) => {
    const next = e.nativeEvent.position ?? 0;
    if (next !== pageRef.current) emitPageChange(next);
  };

  return (
    <PagerView
      ref={pagerRef}
      style={{ flex: 1, backgroundColor: colors.surface }}
      initialPage={Math.max(0, Math.min(pagesCount - 1, curPage))}
      onPageSelected={onSelected}
      offscreenPageLimit={1}
      key={`w${W}-h${H}-v${pagesVersion}`}
    >
      {pages.map((p, i) => (
        <View key={p.id_pagina ?? `p-${i}`} style={{ width: W, height: H }}>
          {/* 👇 Scroll vertical por página */}
          <ScrollView
            style={{ flex: 1, backgroundColor: colors.surface, paddingHorizontal: padX }}
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            // Importante en Android para scroll anidado con PagerView:
            nestedScrollEnabled={true}
            // iOS para ajustar insets del sistema:
            contentInsetAdjustmentBehavior={Platform.OS === "ios" ? "always" : "never"}
            // Opcional: smoother al abrir teclado
            // keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            showsVerticalScrollIndicator
          >
            <FormPageView
              formSession={formSession}
              page={p}
              formName={form?.nombre}
              referenceFrame={referenceFrame}
              // Dale a los hijos el alto útil (H) para cálculos internos si lo usan:
              contentFrame={{ ...contentFrame, width: W, height: H }}
            />
          </ScrollView>
        </View>
      ))}
    </PagerView>
  );
};

export default FormScreen;
