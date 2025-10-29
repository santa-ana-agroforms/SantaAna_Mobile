import Label from "@/components/atoms/Label";
import { Body } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import React from "react";
import { View } from "react-native";

import { selectFieldValue, setFieldValue } from "@/forms/state/formSessionSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

type Frame = { width: number; height: number };

type Props = {
  frame: Frame;
  label?: string;
  help?: string;
  required?: boolean;
  operation?: string;
  vars?: string[];
  fieldName: string;
  sessionId: string;
  pageIndex: number;
  placeholderText?: string;
  format?: (v: unknown) => string;
};

const Box: React.FC<React.PropsWithChildren<{ frame: Frame }>> = ({ frame, children }) => {
  const minSide = Math.min(frame.width, frame.height);
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const inputMinH = clamp(minSide * 0.06, 44, 62);
  const inputPadH = clamp(minSide * 0.014, 12, 18);
  const inputPadV = clamp(minSide * 0.01, 8, 14);
  const inputRadius = clamp(minSide * 0.018, 8, 12);

  return (
    <View
      style={{
        minHeight: inputMinH,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: inputRadius,
        backgroundColor: colors.neutral0,
        paddingHorizontal: inputPadH,
        paddingVertical: inputPadV,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
};

const CalcOutput: React.FC<Props> = ({
  frame,
  label,
  help,
  required,
  operation,
  vars = [],
  fieldName,
  sessionId,
  pageIndex,
  placeholderText = "(calculado)",
  format,
}) => {
  const dispatch = useAppDispatch();

  // 1) Leer todas las variables desde Redux (buscando con nombre en minúsculas)
  const varBag = useAppSelector((state: any) => {
    const bag: Record<string, any> = {};
    for (const v of vars) {
      const lower = String(v || "").toLowerCase();
      const sel = selectFieldValue(sessionId, lower, pageIndex);
      bag[v] = sel(state); // se guarda con la clave EXACTA que vino en vars
      console.log(`[CalcOutput] var "${v}" =`, bag[v]);
    }
    return bag;
  });

  // 2) Construir calcFn desde `operation` (IIFE que expone .default)
  const calcFn: ((props: Record<string, any>) => any) | null = React.useMemo(() => {
    if (!operation) return null;
    try {
      const maybe = eval(operation);
      const fn = maybe?.default ?? (typeof maybe === "function" ? maybe : null);
      return typeof fn === "function" ? fn : null;
    } catch (e) {
      console.warn("[CalcOutput] eval error:", e);
      return null;
    }
  }, [operation]);

  // 3) Ejecutar el cálculo cuando cambian función o valores
  const computed: any = React.useMemo(() => {
    if (!calcFn) return null;
    try {
      console.log("[CalcOutput] executing calcFn with vars:", varBag);
      return calcFn(varBag);
    } catch (e) {
      console.warn("[CalcOutput] exec error:", e);
      return null;
    }
    // Dependencias: la función y el objeto varBag (contiene los valores de cada var)
  }, [calcFn, varBag]);

  // 4) Leer el valor actual almacenado del propio campo para evitar writes innecesarios
  const currentValue = useAppSelector((state: any) => {
    const sel = selectFieldValue(sessionId, fieldName, pageIndex);
    return sel(state);
  });

  // 5) Persistir en Redux si cambió
  React.useEffect(() => {
    if (!sessionId) return;
    const nextVal = computed == null ? null : computed;
    const left = typeof nextVal === "object" ? JSON.stringify(nextVal) : String(nextVal ?? "");
    const right =
      typeof currentValue === "object" ? JSON.stringify(currentValue) : String(currentValue ?? "");
    if (left !== right) {
      dispatch(
        setFieldValue({
          sessionId,
          nombreInterno: fieldName,
          value: nextVal,
          pageIndex,
        })
      );
    }
  }, [computed, currentValue, dispatch, fieldName, pageIndex, sessionId]);

  // 6) Presentación
  const display =
    computed != null && computed !== ""
      ? format
        ? format(computed)
        : String(computed)
      : `${placeholderText} ${operation ? "" : "—"}`.trim();

  return (
    <>
      {label ? <Label frame={frame} text={label} required={required} help={help} /> : null}
      <Box frame={frame}>
        <Body frame={frame} color="secondary" size="sm">
          {display}
        </Body>
      </Box>
    </>
  );
};

export default CalcOutput;
