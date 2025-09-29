import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  SlideInDown,
  SlideOutUp,
} from "react-native-reanimated";

import { Body } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import IconButton from "../atoms/IconButton";

type Frame = { width: number; height: number };

type CampoLite = {
  id_campo: string;
  nombre_interno: string;
  etiqueta?: string;
  requerido?: boolean;
  sequence?: number;
};

export type GroupEntry = {
  id: string;
  values: Record<string, unknown>;
};

type Props = {
  title?: string;
  fieldsTemplate: CampoLite[];
  entries: GroupEntry[];
  onChange: (next: GroupEntry[]) => void;
  referenceFrame: Frame;
  contentFrame: Frame;
  //   getSummary?: (entry: GroupEntry, fields: CampoLite[]) => string;
  children: (args: {
    campo: any;
    entry: GroupEntry;
    onChange: (value: unknown) => void;
  }) => React.ReactNode;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const shallowEqualEntries = (a: GroupEntry[], b: GroupEntry[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ea = a[i];
    const eb = b[i];
    if (ea.id !== eb.id) return false;
    const ka = Object.keys(ea.values);
    const kb = Object.keys(eb.values);
    if (ka.length !== kb.length) return false;
    for (const k of ka) {
      if (!Object.is(ea.values[k], eb.values[k])) return false;
    }
  }
  return true;
};

const RepeatableGroup: React.FC<Props> = ({
  title,
  fieldsTemplate,
  entries,
  onChange,
  referenceFrame,
  //   getSummary,
  children,
}) => {
  const layoutAnim = LinearTransition.springify().damping(18);

  const minSide = Math.min(referenceFrame.width, referenceFrame.height);
  const gap = clamp(minSide * 0.016, 10, 22);
  const boxPad = clamp(minSide * 0.014, 12, 18);
  const radius = clamp(minSide * 0.018, 8, 12);
  const smallGap = clamp(minSide * 0.01, 8, 14);
  const dividerH = clamp(minSide * 0.005, 2, 6);

  const addCardPadV = clamp(minSide * 0.018, 12, 18);
  const addCardPadH = clamp(minSide * 0.02, 14, 22);
  const addCardRadius = clamp(minSide * 0.018, 8, 12);
  const addCardBorder = clamp(minSide * 0.004, 1, 2);
  const iconFrame = { width: referenceFrame.height * 0.55, height: referenceFrame.height * 0.55 };

  const iconSize = clamp(minSide * 0.05, 20, 40); // tamaño de los icon buttons

  // contador simple (sin uuid)
  const [counter, setCounter] = useState(0);

  // colapsado por entrada
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // 1) Si no hay entradas: crea 1 por defecto (expandida)
  useEffect(() => {
    if (entries.length === 0) {
      const first = { id: String(counter), values: {} };
      onChange([first]);
      setCollapsed((c) => ({ ...c, [first.id]: false }));
      setCounter((c) => c + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length]);

  // Limpia colapsados cuando se eliminan entradas
  useEffect(() => {
    setCollapsed((prev) => {
      const next: Record<string, boolean> = {};
      for (const e of entries) if (prev[e.id]) next[e.id] = true;
      return next;
    });
  }, [entries]);

  const safeOnChange = useCallback(
    (next: GroupEntry[]) => {
      if (!shallowEqualEntries(entries, next)) onChange(next);
    },
    [entries, onChange]
  );

  const addEntry = useCallback(() => {
    const newEntry: GroupEntry = { id: String(counter), values: {} };
    safeOnChange([...entries, newEntry]);
    setCollapsed((c) => ({ ...c, [newEntry.id]: false }));
    setCounter((c) => c + 1);
  }, [entries, safeOnChange, counter]);

  const removeEntry = useCallback(
    (id: string) => {
      safeOnChange(entries.filter((e) => e.id !== id));
      setCollapsed((c) => {
        const n = { ...c };
        delete n[id];
        return n;
      });
    },
    [entries, safeOnChange]
  );

  const setEntryCollapsed = useCallback((id: string, v: boolean) => {
    setCollapsed((c) => ({ ...c, [id]: v }));
  }, []);

  const updateField = useCallback(
    (entryId: string, fieldName: string, value: unknown) => {
      const next = entries.map((e) =>
        e.id === entryId ? { ...e, values: { ...e.values, [fieldName]: value } } : e
      );
      safeOnChange(next);
    },
    [entries, safeOnChange]
  );

  const templateSorted = useMemo(
    () =>
      [...fieldsTemplate].sort(
        (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.id_campo.localeCompare(b.id_campo)
      ),
    [fieldsTemplate]
  );

  //   const defaultSummary = useCallback(
  //     (entry: GroupEntry) => {
  //       for (const c of templateSorted) {
  //         const v = entry.values[c.nombre_interno];
  //         if (v === null || v === undefined) continue;
  //         if (typeof v === "string" && v.trim() === "") continue;
  //         return String(v);
  //       }
  //       return entry.id;
  //     },
  //     [templateSorted]
  //   );

  //   const getSummaryText = useCallback(
  //     (entry: GroupEntry) => (getSummary ? getSummary(entry, templateSorted) : defaultSummary(entry)),
  //     [defaultSummary, getSummary, templateSorted]
  //   );

  // Tarjeta “Agregar otro” con animación sutil
  const AddCard = (
    <Animated.View
      entering={FadeIn.duration(150)}
      layout={layoutAnim}
      style={{
        borderWidth: addCardBorder,
        borderStyle: "dashed",
        borderColor: colors.border,
        borderRadius: addCardRadius,
        paddingVertical: addCardPadV,
        paddingHorizontal: addCardPadH,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FAFAFA",
      }}
    >
      <TouchableOpacity onPress={addEntry} accessibilityRole="button">
        <Body weight="bold" style={{ opacity: 0.9, alignSelf: "center" }}>
          + Agregar otro
        </Body>
        <Body size="xs" color="secondary">
          Añade una nueva instancia de este grupo
        </Body>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={{ gap }}>
      {title ? (
        <Body weight="bold" style={{ fontSize: clamp(minSide * 0.05, 16, 22) }}>
          {title}
        </Body>
      ) : null}

      {/* Entradas */}
      {entries.map((entry, idx) => {
        const collapsedNow = !!collapsed[entry.id];
        const canDelete = idx !== 0;
        if (collapsedNow) {
          //   const summary = getSummaryText(entry);
          return (
            <Animated.View
              key={entry.id}
              entering={SlideInDown.springify().damping(18)}
              exiting={SlideOutUp.springify().damping(18)}
              layout={layoutAnim}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius,
                backgroundColor: colors.neutral0,
                paddingHorizontal: boxPad,
                paddingVertical: clamp(minSide * 0.012, 10, 16),
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <TouchableOpacity
                onPress={() => setEntryCollapsed(entry.id, false)}
                style={{ flex: 1, paddingRight: smallGap }}
                accessibilityRole="button"
              >
                <Body weight="bold">
                  #{idx + 1} — {"versión"}
                </Body>
                <Body color="secondary" size="xs">
                  (tocar para editar)
                </Body>
              </TouchableOpacity>

              <View style={{ flexDirection: "row", gap: smallGap }}>
                <IconButton
                  accessibilityLabel="Editar"
                  onPress={() => setEntryCollapsed(entry.id, false)}
                  iconSource={require("../../../assets/images/lapiz.png")}
                  frame={iconFrame}
                  iconSize={iconSize}
                  bgColor={colors.textTertiary}
                  showShadow={false}
                />
                {canDelete ? (
                  <IconButton
                    accessibilityLabel="Eliminar"
                    onPress={() => removeEntry(entry.id)}
                    iconSource={require("../../../assets/images/cerca.png")}
                    frame={iconFrame}
                    showShadow={false}
                    bgColor={colors.danger600}
                    iconSize={iconSize}
                  />
                ) : null}
              </View>
            </Animated.View>
          );
        }

        // Expandido
        return (
          <Animated.View
            key={entry.id}
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(140)}
            layout={layoutAnim}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius,
              backgroundColor: colors.neutral0,
              padding: boxPad,
              gap: smallGap,
            }}
          >
            {/* Cabecera */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Body weight="bold">#{idx + 1} - versión</Body>
              <View style={{ flexDirection: "row", gap: smallGap, alignItems: "center" }}>
                {canDelete ? (
                  <IconButton
                    accessibilityLabel="Eliminar"
                    onPress={() => removeEntry(entry.id)}
                    iconSource={require("../../../assets/images/cerca.png")}
                    frame={iconFrame}
                    iconSize={iconSize}
                    bgColor={colors.danger600}
                    showShadow={false}
                  />
                ) : null}
                <IconButton
                  accessibilityLabel="Completar"
                  onPress={() => setEntryCollapsed(entry.id, true)}
                  iconSource={require("../../../assets/images/marca-de-verificacion.png")}
                  frame={iconFrame}
                  iconSize={iconSize}
                  bgColor={colors.primary600}
                  showShadow={false}
                />
              </View>
            </View>

            {/* Campos */}
            <Animated.View layout={layoutAnim} style={{ gap: smallGap }}>
              {templateSorted.map((campo) => (
                <Animated.View key={campo.id_campo} layout={layoutAnim}>
                  {children({
                    campo,
                    entry,
                    onChange: (v) => updateField(entry.id, campo.nombre_interno, v),
                  })}
                </Animated.View>
              ))}
            </Animated.View>
          </Animated.View>
        );
      })}

      {/* Agregar otro (tarjeta) */}
      {AddCard}

      {/* Divisor final */}
      <Animated.View
        entering={FadeIn.duration(150)}
        layout={layoutAnim}
        style={{
          height: dividerH,
          backgroundColor: colors.textTertiary,
          opacity: 0.9,
          alignSelf: "stretch",
        }}
      />
    </View>
  );
};

export default RepeatableGroup;
