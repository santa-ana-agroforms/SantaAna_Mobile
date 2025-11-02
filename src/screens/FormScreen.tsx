// FormScreen.tsx
import AnimatedPage from "@/components/atoms/AnimatedPage";
import { colors } from "@/theme/tokens";
import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
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

// 👇 Gesture Handler
import { Gesture, GestureDetector } from "react-native-gesture-handler";

type Frame = { width: number; height: number };

type Props = {
  form: Formulario;
  referenceFrame: Frame;
  contentFrame: Frame;
  layoutFrame?: Frame;
  page?: number;
  onPageChange?: (index: number) => void;
  mode?: "edit" | "review" | "view";
  /** si es false, NO se permite swipe hacia adelante */
  canGoNext?: boolean;
};

const SWIPE_BACK_THRESHOLD = 24; // px de arrastre para considerar “volver”
const SWIPE_BACK_VELOCITY = 300; // px/s mínima hacia la derecha

const FormScreen: React.FC<Props> = ({
  form,
  referenceFrame,
  contentFrame,
  page,
  onPageChange,
  mode,
  canGoNext = true,
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

  // Trackers
  const nativePageRef = useRef<number>(curPage);
  const isSyncingRef = useRef<boolean>(false);

  const W = Math.max(1, Math.round(referenceFrame.width || 1));
  const H = Math.max(1, Math.round(referenceFrame.height || 1));
  const padX = referenceFrame.width * 0.04;

  // Valor compartido para animaciones internas
  const current = useSharedValue(curPage);

  const onPageScroll = (e: PagerViewOnPageScrollEvent) => {
    const { position = 0, offset = 0 } = e.nativeEvent;
    current.value = position + offset;
  };

  const onSelected = (e: PagerViewOnPageSelectedEvent) => {
    const next = e.nativeEvent.position ?? 0;
    if (isSyncingRef.current) return;

    if (next !== nativePageRef.current) {
      nativePageRef.current = next;
    }

    if (next !== curPage && sessionId) {
      dispatch(goToPage({ sessionId, index: next }));
      onPageChange?.(next);
    }

    current.value = next;
  };

  // Sincroniza Store -> Pager
  useEffect(() => {
    if (!pagesCount) return;

    if (nativePageRef.current !== curPage) {
      isSyncingRef.current = true;
      requestAnimationFrame(() => {
        pagerRef.current?.setPageWithoutAnimation(curPage);
        nativePageRef.current = curPage;
        current.value = curPage;
        requestAnimationFrame(() => {
          isSyncingRef.current = false;
        });
      });
    } else {
      current.value = curPage;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curPage, pagesCount]);

  // Re-sincroniza por cambios de tamaño
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

  // 👇 Capa gestual para “volver” cuando el Pager está bloqueado hacia adelante
  const backSwipe = Gesture.Pan()
    .activeOffsetX([SWIPE_BACK_THRESHOLD, Infinity]) // solo movimientos a la derecha
    .onEnd((e) => {
      // Dispara “volver” si hay intención clara
      if (e.translationX > SWIPE_BACK_THRESHOLD || e.velocityX > SWIPE_BACK_VELOCITY) {
        const prev = Math.max(0, curPage - 1);
        if (prev !== curPage && sessionId) {
          // sincroniza store + UI sin animación
          pagerRef.current?.setPageWithoutAnimation(prev);
          nativePageRef.current = prev;
          current.value = prev;
          dispatch(goToPage({ sessionId, index: prev }));
          onPageChange?.(prev);
        }
      }
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* PagerView: si NO se puede avanzar, scrollEnabled=false ⇒ ningún efecto visual hacia delante */}
      <PagerView
        ref={pagerRef}
        style={StyleSheet.absoluteFill}
        initialPage={Math.max(0, Math.min(pagesCount - 1, curPage))}
        onPageSelected={onSelected}
        onPageScroll={onPageScroll}
        offscreenPageLimit={1}
        overScrollMode="never"
        scrollEnabled={canGoNext} // 🔑 bloquea todo el swipe del pager si no se puede avanzar
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
            mode={mode}
          />
        ))}
      </PagerView>

      {/* Capa para permitir SOLO volver cuando el pager está bloqueado */}
      {!canGoNext && curPage > 0 && (
        <GestureDetector gesture={backSwipe}>
          <View
            // capa invisible que ocupa todo: intercepta el gesto de “volver”
            pointerEvents="box-none"
            style={StyleSheet.absoluteFill}
          />
        </GestureDetector>
      )}
    </View>
  );
};

export default FormScreen;
