import { colors } from "@/theme/tokens";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  PanResponderInstance,
  StyleSheet,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { captureRef } from "react-native-view-shot";

type Frame = { width: number; height: number };

export type SignaturePadHandle = {
  clear: () => void;
  undo: () => void;
  isEmpty: () => boolean;
  exportImage: (opts?: {
    format?: "png" | "jpg";
    quality?: number;
    result?: "tmpfile" | "base64" | "data-uri";
    backgroundColor?: string;
    scale?: number; // factor de resolución adicional (1 = tal cual layout)
  }) => Promise<string>;
  getCanvasSize?: () => { w: number; h: number }; // 👈 opcional
};

type Props = {
  width: string | number; // puede ser "100%"
  height: number; // alto en px
  strokeColor?: string;
  strokeWidth?: number;
  canvasBackground?: string;
  smooth?: boolean;
  onChangeStrokes?: (strokes: [number, number][][]) => void;
  frame?: Frame;
  disabled?: boolean;
};

type Point = [number, number];
type Stroke = Point[];

const toPathD = (pts: Stroke, smooth = true) => {
  if (pts.length === 0) return "";
  if (!smooth || pts.length < 3) {
    return `M ${pts.map((p) => p.join(",")).join(" L ")}`;
  }
  const d: string[] = [];
  d.push(`M ${pts[0][0]},${pts[0][1]}`);
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    d.push(`Q ${x0},${y0} ${cx},${cy}`);
  }
  const last = pts[pts.length - 1];
  d.push(`L ${last[0]},${last[1]}`);
  return d.join(" ");
};

const SignaturePad = forwardRef<SignaturePadHandle, Props>(
  (
    {
      width,
      height,
      strokeColor = colors.textPrimary,
      strokeWidth = 2.5,
      canvasBackground = colors.neutral0,
      smooth = true,
      onChangeStrokes,
      disabled = false,
    },
    ref
  ) => {
    const viewRef = useRef<View>(null);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [current, setCurrent] = useState<Stroke>([]);

    // ⬇️ Dimensiones reales del contenedor (lo que se ve en pantalla)
    const [layoutW, setLayoutW] = useState(0);
    const [layoutH, setLayoutH] = useState(0);

    const onLayout = useCallback((e: LayoutChangeEvent) => {
      const { width: lw, height: lh } = e.nativeEvent.layout;
      if (lw > 0 && lh > 0) {
        setLayoutW(lw);
        setLayoutH(lh);
      }
    }, []);

    // Callback estable
    const cbRef = useRef<typeof onChangeStrokes>(undefined);
    useEffect(() => {
      cbRef.current = onChangeStrokes;
    }, [onChangeStrokes]);

    useEffect(() => {
      cbRef.current?.(strokes as [number, number][][]);
    }, [strokes]);

    const start = useCallback((x: number, y: number) => {
      setCurrent([[x, y]]);
    }, []);

    const move = useCallback((x: number, y: number) => {
      setCurrent((c) => (c.length ? [...c, [x, y]] : c));
    }, []);

    const end = useCallback(() => {
      setStrokes((prev) => (current.length ? [...prev, current] : prev));
      setCurrent([]);
    }, [current]);

    const pan: PanResponderInstance = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => !disabled,
          onMoveShouldSetPanResponder: () => !disabled,
          onPanResponderGrant: (e: GestureResponderEvent) => {
            const { locationX, locationY } = e.nativeEvent;
            start(locationX, locationY);
          },
          onPanResponderMove: (e: GestureResponderEvent) => {
            const { locationX, locationY } = e.nativeEvent;
            move(locationX, locationY);
          },
          onPanResponderRelease: end,
          onPanResponderTerminate: end,
        }),
      [disabled, end, move, start]
    );

    useImperativeHandle(ref, () => ({
      clear: () => {
        setCurrent([]);
        setStrokes([]);
      },
      undo: () => {
        setCurrent([]);
        setStrokes((prev) => prev.slice(0, -1));
      },
      isEmpty: () => strokes.length === 0 && current.length === 0,

      // ⬇️ Exporta con el MISMO tamaño visual del contenedor
      exportImage: async (opts) => {
        const {
          format = "png",
          quality = 1,
          result = "tmpfile",
          scale = 1, // si quieres más resolución, sube a 2; mantiene relación de aspecto
        } = opts ?? {};

        if (!viewRef.current) throw new Error("SignaturePad: viewRef vacío");

        // Si por alguna razón aún no tenemos layout (raro), caemos a props numéricas
        const numericW = layoutW > 0 ? layoutW : typeof width === "number" ? width : 0;
        const numericH = layoutH > 0 ? layoutH : height;

        const targetW = Math.max(1, Math.round(numericW * scale));
        const targetH = Math.max(1, Math.round(numericH * scale));

        const uri = await captureRef(viewRef, {
          format,
          quality,
          result, // "base64" para tu caso
          // backgroundColor, // "#FFF" si quieres fondo blanco
          width: targetW,
          height: targetH,
          // usePlatformRenderer: true, // opcional
        });
        return uri;
      },

      // opcional: útil para guardar meta y usar aspectRatio en preview
      getCanvasSize: () => ({
        w: layoutW > 0 ? layoutW : typeof width === "number" ? width : 0,
        h: layoutH > 0 ? layoutH : height,
      }),
    }));

    return (
      <View
        ref={viewRef}
        collapsable={false}
        onLayout={onLayout} // 👈 importante
        style={[
          styles.container,
          {
            width: typeof width === "number" ? width : "100%",
            height,
            backgroundColor: canvasBackground,
          },
        ]}
        onStartShouldSetResponder={() => true}
        {...pan.panHandlers}
      >
        {/* El SVG llena el contenedor → lo que ves = lo que se exporta */}
        <Svg width="100%" height="100%">
          {strokes.map((s, i) => (
            <Path
              key={i}
              d={toPathD(s, smooth)}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {current.length ? (
            <Path
              d={toPathD(current, smooth)}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
        </Svg>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
});

SignaturePad.displayName = "SignaturePad";

export default SignaturePad;
