// src/screens/FormScreen.tsx
import PageScaffold from "@/components/templates/PageScaffold";
import { useResponsive } from "@/hooks/useResponsive";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  useWindowDimensions,
  View,
} from "react-native";
import FormPageView, { Formulario, Pagina } from "./FormPage";

interface Props { form: Formulario; }

export default function FormScreen({ form }: Props) {
  const formId = form?.id_formulario;
  const rawPages = form?.paginas ?? [];

  // 1) Congela las páginas: solo cambian cuando cambia el formId
  const pagesRef = useRef<Pagina[]>([]);
  const [pagesVersion, setPagesVersion] = useState(0); // fuerza 1 re-render cuando cambia formId

  useEffect(() => {
    const sorted = rawPages.slice().sort(
      (a, b) => (a.secuencia ?? 0) - (b.secuencia ?? 0)
    );
    pagesRef.current = sorted;
    setPagesVersion(v => v + 1); // un render para tomar el nuevo data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  const pages = pagesRef.current;
  const pagesCount = pages.length;

  const { width } = useWindowDimensions();
  const W = Math.round(Math.max(1, width));
  const { gutter } = useResponsive();

  // 2) Índice controlado + autoridad en ref
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  pageRef.current = page;

  // Reset índice al cambiar de formulario
  useEffect(() => {
    setPage(0);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [formId]);

  const listRef = useRef<FlatList<Pagina>>(null);
  const isProgrammatic = useRef(false);

  // 3) Recoloca offset si cambia el ancho o la longitud (layout nuevo)
  useEffect(() => {
    if (!pagesCount) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({
        offset: W * pageRef.current,
        animated: false,
      });
    });
  }, [W, pagesCount, pagesVersion]);

  const getItemLayout = (_: ArrayLike<Pagina> | null | undefined, index: number) => ({
    length: W,
    offset: W * index,
    index,
  });

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isProgrammatic.current) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / W);
    if (i !== pageRef.current) setPage(i);
  };

  const onScrollToIndexFailed = ({ index }: { index: number }) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({
        offset: W * index,
        animated: false,
      });
    });
  };

  const goTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(pagesCount - 1, idx));
    if (clamped === pageRef.current) return;
    isProgrammatic.current = true;
    setPage(clamped);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: clamped, animated: true });
      setTimeout(() => (isProgrammatic.current = false), 140);
    });
  };

  const renderItem = ({ item }: ListRenderItemInfo<Pagina>) => (
    <View style={{ width: W, flex: 1, backgroundColor: "#F9F6EE" }} collapsable={false}>
      <FormPageView page={item} formName={form?.nombre} />
    </View>
  );

  const isAndroid = Platform.OS === "android";
  const listPagingProps = isAndroid
    ? { snapToInterval: W, snapToAlignment: "start" as const, pagingEnabled: false, decelerationRate: "fast" as const }
    : { pagingEnabled: true, decelerationRate: "fast" as const };

  return (
    <PageScaffold
      title={form?.nombre ?? "Formulario"}
      variant="form"
      page={page + 1}
      totalPages={pagesCount}
      onPrevPage={() => goTo(page - 1)}
      onNextPage={() => goTo(page + 1)}
    >
      <FlatList
        ref={listRef}
        data={pages}                         // <- data NO cambia identidad en cada render
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
        style={{ flex: 1, backgroundColor: "#F9F6EE" }}
        contentContainerStyle={{ backgroundColor: "#F9F6EE" }}
        {...listPagingProps}
      />
    </PageScaffold>
  );
}
