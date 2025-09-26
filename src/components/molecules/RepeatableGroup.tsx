import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";

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
  // getSummary?: (entry: GroupEntry, fields: CampoLite[]) => string;
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
  // getSummary,
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
  const iconSize = clamp(minSide * 0.05, 20, 40);

  const [counter, setCounter] = useState(0);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Si no hay entradas, crea una
  useEffect(() => {
    if (entries.length === 0) {
      const first = { id: String(counter), values: {} };
      onChange([first]);
      setCollapsed((c) => ({ ...c, [first.id]: false }));
      setCounter((c) => c + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length]);

  // Limpia colapsados de entradas removidas
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

  // const defaultSummary = useCallback(
  //   (entry: GroupEntry) => {
  //     for (const c of templateSorted) {
  //       const v = entry.values[c.nombre_interno];
  //       if (v === null || v === undefined) continue;
  //       if (typeof v === "string" && v.trim() === "") continue;
  //       return String(v);
  //     }
  //     return `#${entry.id}`;
  //   },
  //   [templateSorted]
  // );

  const AddCard = (
    <Animated.View layout={layoutAnim} pointerEvents="box-none">
      <Animated.View
        entering={FadeIn.duration(150)}
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
    </Animated.View>
  );

  return (
    <View style={{ gap }}>
      {title ? (
        <Body weight="bold" style={{ fontSize: clamp(minSide * 0.05, 16, 22) }}>
          {title}
        </Body>
      ) : null}

      {entries.map((entry, idx) => {
        const collapsedNow = !!collapsed[entry.id];
        const canDelete = idx !== 0;

        return (
          <Animated.View key={entry.id} layout={layoutAnim} pointerEvents="box-none">
            <Animated.View
              layout={layoutAnim}
              entering={FadeIn.duration(120)}
              exiting={FadeOut.duration(100)}
              collapsable={false}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius,
                backgroundColor: colors.neutral0,
                padding: boxPad,
                marginTop: idx === 0 ? gap * 0.5 : 0,
              }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                pointerEvents="box-none"
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
                    accessibilityLabel={collapsedNow ? "Editar" : "Completar"}
                    onPress={() => setEntryCollapsed(entry.id, !collapsedNow)}
                    iconSource={
                      collapsedNow
                        ? require("../../../assets/images/lapiz.png")
                        : require("../../../assets/images/marca-de-verificacion.png")
                    }
                    frame={iconFrame}
                    iconSize={iconSize}
                    bgColor={collapsedNow ? colors.textTertiary : colors.primary600}
                    showShadow={false}
                  />
                </View>
              </View>

              {/* Contenido (solo uno vive a la vez). 
                  El que SALE se marca pointerEvents="none" con el prop local */}
              <Animated.View layout={layoutAnim} style={{ gap: smallGap }} collapsable={false}>
                {collapsedNow ? null : (
                  <Animated.View
                    key="fields"
                    layout={layoutAnim}
                    entering={FadeIn.duration(120)}
                    exiting={FadeOut.duration(80)}
                    pointerEvents="box-none"
                    style={{ gap: smallGap }}
                  >
                    {templateSorted.map((campo) => (
                      <Animated.View
                        key={campo.id_campo}
                        layout={layoutAnim}
                        collapsable={false}
                        pointerEvents="box-none"
                      >
                        {children({
                          campo,
                          entry,
                          onChange: (v) => updateField(entry.id, campo.nombre_interno, v),
                        })}
                      </Animated.View>
                    ))}
                  </Animated.View>
                )}
              </Animated.View>
            </Animated.View>
          </Animated.View>
        );
      })}

      {AddCard}

      <Animated.View layout={layoutAnim} pointerEvents="box-none">
        <View
          style={{
            height: dividerH,
            backgroundColor: colors.textTertiary,
            opacity: 0.9,
            alignSelf: "stretch",
          }}
        />
      </Animated.View>
    </View>
  );
};

export default RepeatableGroup;
