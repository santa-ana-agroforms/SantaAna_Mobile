// src/screens/FormScreen.tsx
import { FormSession } from "@/forms/runtime/FormSession";
import { colors } from "@/theme/tokens";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  View,
} from "react-native";
import FormPageView, { type Formulario, type Pagina } from "./FormPage";

type Frame = { width: number; height: number };

type Props = {
  form: Formulario;
  referenceFrame: Frame;
  contentFrame: Frame;
  layoutFrame: Frame;
  page?: number;
  onPageChange?: (index: number) => void;
  formSession: FormSession;
};

const FormScreen: React.FC<Props> = ({
  form,
  referenceFrame,
  contentFrame,
  layoutFrame,
  page,
  onPageChange,
  formSession,
}) => {
  const formId = form?.id_formulario;
  const rawPages = React.useMemo(() => form?.paginas ?? [], [form?.paginas]);

  // 1) Congelar y ordenar páginas por secuencia (solo cuando cambia el formId)
  const pagesRef = useRef<Pagina[]>([]);
  const [pagesVersion, setPagesVersion] = useState(0);

  useEffect(() => {
    const sorted = rawPages.slice().sort((a, b) => (a.secuencia ?? 0) - (b.secuencia ?? 0));
    pagesRef.current = sorted;
    setPagesVersion((v) => v + 1);
  }, [formId, rawPages]);

  const pages = pagesRef.current;
  const pagesCount = pages.length;

  // 2) Controlado vs no controlado
  const isControlled = typeof page === "number";
  const [uPage, setUPage] = useState(0);
  const curPage = isControlled ? (page as number) : uPage;

  // refs para evitar cierres obsoletos
  const pageRef = useRef(curPage);
  pageRef.current = curPage;

  // Reset índice al cambiar de formulario
  useEffect(() => {
    if (!pagesCount) return;
    const resetTo = 0;
    if (!isControlled) setUPage(resetTo);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [formId, pagesCount, isControlled]);

  const listRef = useRef<FlatList<Pagina>>(null);
  const isProgrammatic = useRef(false);

  // 3) Recolocar offset si cambia el ancho útil o la longitud
  const W = Math.max(1, Math.round(layoutFrame.width || 1));

  useEffect(() => {
    if (!pagesCount) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({
        offset: W * pageRef.current,
        animated: false,
      });
    });
  }, [W, pagesCount, pagesVersion]);

  // Si es controlado y cambia 'page' desde el padre, sincroniza el scroll
  useEffect(() => {
    if (!isControlled) return;
    const target = Math.max(0, Math.min(pagesCount - 1, pageRef.current));
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: target, animated: false });
    });
  }, [isControlled, pagesCount, page]);

  const getItemLayout = (_: ArrayLike<Pagina> | null | undefined, index: number) => ({
    length: W,
    offset: W * index,
    index,
  });

  const emitPageChange = (next: number) => {
    if (!isControlled) setUPage(next);
    onPageChange?.(next);
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isProgrammatic.current) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / W);
    if (i !== pageRef.current) emitPageChange(i);
  };

  const onScrollToIndexFailed = ({ index }: { index: number }) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({
        offset: W * index,
        animated: false,
      });
    });
  };

  // Expones helpers si luego quieres controlarlos desde arriba (via ref/imperativeHandle)

  const renderItem = ({ item }: ListRenderItemInfo<Pagina>) => (
    <View
      style={{
        width: W,
        height: contentFrame.height,
        backgroundColor: colors.surface,
      }}
      collapsable={false}
    >
      <FormPageView
        page={item}
        formName={form?.nombre}
        referenceFrame={referenceFrame}
        contentFrame={contentFrame}
        formSession={formSession} // si quieres pasar la sesión, agrega a Props
        // cualquier prop adicional de página
      />
    </View>
  );

  const isAndroid = Platform.OS === "android";
  const listPagingProps = isAndroid
    ? {
        snapToInterval: W,
        snapToAlignment: "start" as const,
        pagingEnabled: false,
        decelerationRate: "fast" as const,
      }
    : { pagingEnabled: true, decelerationRate: "fast" as const };

  return (
    <FlatList
      ref={listRef}
      data={pages}
      keyExtractor={(p) => p.id_pagina}
      renderItem={renderItem}
      horizontal
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={onMomentumEnd}
      onScrollToIndexFailed={onScrollToIndexFailed}
      getItemLayout={getItemLayout}
      windowSize={3}
      initialNumToRender={2}
      maxToRenderPerBatch={3}
      removeClippedSubviews={false}
      disableIntervalMomentum
      scrollEventThrottle={16}
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ backgroundColor: colors.surface }}
      {...listPagingProps}
    />
  );
};

export default FormScreen;
