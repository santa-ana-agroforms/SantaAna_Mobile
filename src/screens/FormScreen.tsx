import AnimatedPage from "@/components/atoms/AnimatedPage";
import { colors } from "@/theme/tokens";
import React, { useEffect, useMemo, useRef, useState } from "react";
import PagerView, {
  type PagerViewOnPageScrollEvent,
  type PagerViewOnPageSelectedEvent,
} from "react-native-pager-view";
import { useSharedValue } from "react-native-reanimated";
import { type Formulario, type Pagina } from "./FormPage";

type Frame = { width: number; height: number };

type Props = {
  form: Formulario;
  referenceFrame: Frame;
  contentFrame: Frame;
  layoutFrame: Frame;
  page?: number;
  onPageChange?: (index: number) => void;
};

// ✅ Hook para el estilo animado
const FormScreen: React.FC<Props> = ({
  form,
  referenceFrame,
  contentFrame,
  page,
  onPageChange,
}) => {
  const rawPages = useMemo(() => form?.paginas ?? [], [form?.paginas]);

  const pagesRef = useRef<Pagina[]>([]);
  const [pagesVersion, setPagesVersion] = useState(0);
  useEffect(() => {
    const sorted = rawPages.slice().sort((a, b) => (a.secuencia ?? 0) - (b.secuencia ?? 0));
    pagesRef.current = sorted;
    setPagesVersion((v) => v + 1);
  }, [form?.id_formulario, rawPages]);

  const pages = pagesRef.current;
  const pagesCount = pages.length;

  const isControlled = typeof page === "number";
  const [uPage, setUPage] = useState(0);
  const curPage = isControlled ? (page as number) : uPage;

  const pagerRef = useRef<PagerView>(null);
  const pageRef = useRef(curPage);
  pageRef.current = curPage;

  const W = Math.max(1, Math.round(referenceFrame.width || 1));
  const H = Math.max(1, Math.round(referenceFrame.height || 1));
  const padX = referenceFrame.width * 0.04;

  // 🎯 Posición fraccional compartida para animar
  const current = useSharedValue(curPage);

  const onPageScroll = (e: PagerViewOnPageScrollEvent) => {
    const { position, offset } = e.nativeEvent;
    current.value = (position ?? 0) + (offset ?? 0);
  };

  useEffect(() => {
    if (!pagesCount) return;
    if (!isControlled) setUPage(0);
    requestAnimationFrame(() => {
      pagerRef.current?.setPageWithoutAnimation(0);
      current.value = 0;
    });
  }, [form?.id_formulario, pagesCount, isControlled, current]);

  useEffect(() => {
    if (!isControlled || pagesCount === 0) return;
    const target = Math.max(0, Math.min(pagesCount - 1, page ?? 0));
    requestAnimationFrame(() => {
      pagerRef.current?.setPage(target);
      current.value = target;
    });
  }, [isControlled, pagesCount, page, current]);

  useEffect(() => {
    if (!pagesCount) return;
    requestAnimationFrame(() => {
      pagerRef.current?.setPageWithoutAnimation(pageRef.current);
      current.value = pageRef.current;
    });
  }, [W, H, pagesCount, pagesVersion, current]);

  const emitPageChange = (next: number) => {
    if (!isControlled) setUPage(next);
    onPageChange?.(next);
  };

  const onSelected = (e: PagerViewOnPageSelectedEvent) => {
    const next = e.nativeEvent.position ?? 0;
    if (next !== pageRef.current) emitPageChange(next);
    current.value = next;
  };

  return (
    <PagerView
      ref={pagerRef}
      style={{ flex: 1, backgroundColor: colors.surface }}
      initialPage={Math.max(0, Math.min(pagesCount - 1, curPage))}
      onPageSelected={onSelected}
      onPageScroll={onPageScroll}
      offscreenPageLimit={1}
      overScrollMode="never"
      key={`w${W}-h${H}-v${pagesVersion}`}
    >
      {pages.map((p, i) => (
        <AnimatedPage
          key={p.id_pagina ?? `p-${i}`}
          index={i}
          current={current}
          width={W}
          height={H}
          padX={padX}
          page={p}
          formName={form?.nombre}
          referenceFrame={referenceFrame}
          contentFrame={contentFrame}
        />
      ))}
    </PagerView>
  );
};

export default FormScreen;
