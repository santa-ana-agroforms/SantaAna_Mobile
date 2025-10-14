import AnimatedPage from "@/components/atoms/AnimatedPage";
import { colors } from "@/theme/tokens";
import React, { useEffect, useMemo, useRef } from "react";
import PagerView, {
  type PagerViewOnPageScrollEvent,
  type PagerViewOnPageSelectedEvent,
} from "react-native-pager-view";
import { useSharedValue } from "react-native-reanimated";
import { type Formulario, type Pagina } from "./FormPage";

// Redux
import {
  goToPage,
  selectCurrentSession,
  selectCurrentSessionId,
} from "@/forms/state/formSessionSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

type Frame = { width: number; height: number };

type Props = {
  form: Formulario;
  referenceFrame: Frame;
  contentFrame: Frame;
  layoutFrame?: Frame;
  page?: number;
  onPageChange?: (index: number) => void;
};

const FormScreen: React.FC<Props> = ({
  form,
  referenceFrame,
  contentFrame,
  page,
  onPageChange,
}) => {
  const dispatch = useAppDispatch();
  const sessionId = useAppSelector(selectCurrentSessionId);
  const curFromSlice = useAppSelector(selectCurrentSession)?.currentPageIndex ?? 0;

  // Páginas estables
  const pages: Pagina[] = useMemo(
    () => (form?.paginas ?? []).slice().sort((a, b) => (a.secuencia ?? 0) - (b.secuencia ?? 0)),
    [form?.paginas]
  );
  const pagesCount = pages.length;

  // Controlado vs no controlado
  const isControlled = typeof page === "number";
  const curPage = isControlled ? (page as number) : curFromSlice;

  const pagerRef = useRef<PagerView>(null);

  // Track de página “nativa” del Pager y flag de sincronización
  const nativePageRef = useRef<number>(curPage);
  const isSyncingRef = useRef<boolean>(false);

  const W = Math.max(1, Math.round(referenceFrame.width || 1));
  const H = Math.max(1, Math.round(referenceFrame.height || 1));
  const padX = referenceFrame.width * 0.04;

  // Reanimated shared value para animaciones (no en deps)
  const current = useSharedValue(curPage);

  const onPageScroll = (e: PagerViewOnPageScrollEvent) => {
    const { position, offset } = e.nativeEvent;
    current.value = (position ?? 0) + (offset ?? 0);
  };

  // Sincroniza Pager -> Store (solo si cambia realmente y no estamos sincronizando)
  const onSelected = (e: PagerViewOnPageSelectedEvent) => {
    const next = e.nativeEvent.position ?? 0;

    // Ignora eventos provocados por nuestra propia sync
    if (isSyncingRef.current) return;

    if (next !== nativePageRef.current) {
      nativePageRef.current = next;
    }

    // Despacha solo si difiere del valor del store/controlado
    if (next !== curPage && sessionId) {
      dispatch(goToPage({ sessionId, index: next }));
      onPageChange?.(next);
    }

    current.value = next;
  };

  // Sincroniza Store -> Pager (solo si difiere)
  useEffect(() => {
    if (!pagesCount) return;

    if (nativePageRef.current !== curPage) {
      isSyncingRef.current = true;
      requestAnimationFrame(() => {
        // setPageWithoutAnimation puede disparar onPageSelected en algunos targets
        pagerRef.current?.setPageWithoutAnimation(curPage);
        nativePageRef.current = curPage;
        current.value = curPage;
        // suelta el flag en el próximo frame para ignorar el evento que pueda venir
        requestAnimationFrame(() => {
          isSyncingRef.current = false;
        });
      });
    } else {
      // Si ya coincide, solo actualiza la animación
      current.value = curPage;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curPage, pagesCount]);

  // Re-sincroniza por cambios de tamaño (sin bucle)
  useEffect(() => {
    if (!pagesCount) return;
    isSyncingRef.current = true;
    requestAnimationFrame(() => {
      pagerRef.current?.setPageWithoutAnimation(nativePageRef.current);
      current.value = nativePageRef.current;
      requestAnimationFrame(() => {
        isSyncingRef.current = false;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H, pagesCount]);

  // console.log("form", JSON.stringify(form, null, 2));
  return (
    <PagerView
      ref={pagerRef}
      style={{ flex: 1, backgroundColor: colors.surface }}
      initialPage={Math.max(0, Math.min(pagesCount - 1, curPage))}
      onPageSelected={onSelected}
      onPageScroll={onPageScroll}
      offscreenPageLimit={1}
      overScrollMode="never"
      // Sin key volátil
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
