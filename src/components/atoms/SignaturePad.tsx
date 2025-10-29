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
    scale?: number;
  }) => Promise<string>;
};

type Props = {
  width: string | number;
  height: number;
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

    // 🧠 Guardar la referencia del callback para evitar recrear el efecto
    const cbRef = useRef<typeof onChangeStrokes>(undefined);
    useEffect(() => {
      cbRef.current = onChangeStrokes;
    }, [onChangeStrokes]);

    // 🔁 Efecto sólo cuando cambian los strokes (no la identidad del callback)
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
      exportImage: async (opts) => {
        const {
          format = "png",
          quality = 0.92,
          result = "tmpfile",
          backgroundColor = undefined,
          scale = 1,
        } = opts ?? {};
        if (!viewRef.current) throw new Error("SignaturePad: viewRef vacío");

        const uri = await captureRef(viewRef, {
          format,
          quality,
          result,
          // @ts-expect-error view-shot acepta undefined
          backgroundColor,
          width: Math.round(typeof width === "number" ? width : 1.5 * scale),
          height: Math.round(height * scale),
        });
        return uri;
      },
    }));

    return (
      <View
        ref={viewRef}
        collapsable={false}
        style={[
          styles.container,
          {
            width: "100%",
            height,
            backgroundColor: canvasBackground,
          },
        ]}
        onStartShouldSetResponder={() => true}
        {...pan.panHandlers}
      >
        <Svg width={width} height={height}>
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
