// atoms/CalculatedField.tsx
import Label from "@/components/atoms/Label";
import { Body } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import React, { useEffect, useMemo } from "react";
import { View } from "react-native";

type CampoConfig = {
  clase?: string;
  config?: { operation?: string; vars?: string[] };
  etiqueta?: string;
  id_campo: string;
  nombre_interno: string;
  requerido: boolean;
  tipo: string;
};

type Props = {
  campo: CampoConfig;
  value?: string | number | null; // valor ya guardado (si hay)
  getVar: (name: string) => any; // lee cada var por nombre
  onComputed: (value: string) => void; // persistir en redux
  labelSlot?: React.ReactNode;
  referenceFrame: { width: number; height: number };
};

const CalculatedField: React.FC<Props> = ({
  campo,
  value,
  getVar,
  onComputed,
  labelSlot,
  referenceFrame,
}) => {
  // compilar exactamente como dijo tu amigo
  const opFn = useMemo(() => {
    const src = campo?.config?.operation;
    if (!src) return null;
    try {
      const mod: any = eval(src);
      return typeof mod?.default === "function" ? mod.default : null;
    } catch {
      return null;
    }
  }, [campo?.config?.operation]);

  // armar objeto { varName: valor }
  const varsObj = useMemo(() => {
    const out: Record<string, any> = {};
    (campo?.config?.vars ?? []).forEach((n) => (out[n] = getVar(n)));
    return out;
  }, [campo?.config?.vars, getVar]);

  // ejecutar
  const computed = useMemo(() => {
    if (!opFn) return null;
    try {
      const res = opFn(varsObj);
      return res != null ? String(res) : "";
    } catch {
      return null;
    }
  }, [opFn, varsObj]);

  // avisar arriba solo si no hay value materializado
  useEffect(() => {
    if (value == null && typeof computed === "string") onComputed(computed);
  }, [computed, onComputed, value]);

  const finalValue = value ?? computed ?? `(calculado) ${campo?.config?.operation ? "listo" : "—"}`;

  return (
    <>
      {labelSlot ?? (
        <Label
          frame={referenceFrame}
          text={campo?.etiqueta ?? campo?.nombre_interno ?? "Calculado"}
          required={!!campo?.requerido}
        />
      )}
      <View
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          backgroundColor: colors.neutral0,
          paddingHorizontal: 12,
          paddingVertical: 10,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Body frame={referenceFrame} color="secondary" size="sm">
          {finalValue}
        </Body>
      </View>
    </>
  );
};

export default CalculatedField;
