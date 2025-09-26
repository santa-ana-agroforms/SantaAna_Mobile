// src/components/atoms/DatasetSelect.tsx
import { Body } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  TextStyle,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";

type Frame = { width: number; height: number };
type Primitive = string | number | boolean;
type Item = Primitive | { label: string; value: Primitive };

type Props = {
  frame?: Frame;
  value?: Primitive | undefined;
  onChange?: (v: Primitive | undefined) => void;
  placeholder?: string;
  items?: Item[];
  disabled?: boolean;
  error?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;

  allowDeselect?: boolean;
  showNoneOption?: boolean;
  noneLabel?: string;

  /** Opcional: personalizar cómo se muestra cada valor */
  formatLabel?: (v: Primitive) => string;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const DEMO_ITEMS: Primitive[] = ["Manzanas", "Bananas", "Naranjas", "Peras", "Uvas"];

const defaultLabel = (v: Primitive) => (typeof v === "boolean" ? (v ? "Sí" : "No") : String(v));

const normalize = (
  arr?: Item[],
  fmt?: (v: Primitive) => string
): { label: string; value: Primitive }[] => {
  const src = arr && arr.length ? arr : DEMO_ITEMS;
  const out: { label: string; value: Primitive }[] = [];
  const seen = new Set<string>();

  for (const it of src) {
    const value =
      typeof it === "object" && it !== null && "value" in it
        ? ((it as any).value as Primitive)
        : (it as Primitive);
    const label =
      typeof it === "object" && it !== null && "label" in it
        ? String((it as any).label)
        : fmt
          ? fmt(value)
          : defaultLabel(value);

    // clave única por tipo + valor (evita colisiones "true" vs "1")
    const key = `${typeof value}:${String(value)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, value });
  }
  return out;
};

const DatasetSelect: React.FC<Props> = ({
  frame,
  value,
  onChange,
  placeholder = "Selecciona una opción…",
  items,
  disabled = false,
  error = false,
  style,
  textStyle,
  allowDeselect = true,
  showNoneOption = true,
  noneLabel = "Ninguno",
  formatLabel,
}) => {
  const { width: ww, height: hh } = useWindowDimensions();
  const baseFrame = frame ?? { width: ww, height: hh };
  const [open, setOpen] = useState(false);

  const list = useMemo(() => normalize(items, formatLabel), [items, formatLabel]);

  const dims = useMemo(() => {
    const minSide = Math.min(baseFrame.width, baseFrame.height);
    const baseRem = clamp(minSide * 0.042, 14, 18);
    return {
      radius: clamp(minSide * 0.018, 8, 12),
      padH: clamp(minSide * 0.014, 12, 18),
      padV: clamp(minSide * 0.01, 8, 14),
      minH: clamp(minSide * 0.06, 44, 62),
      font: clamp(baseRem * 1.05, 14, 20),
      optionPadV: clamp(minSide * 0.01, 8, 14),
      optionPadH: clamp(minSide * 0.014, 12, 18),
      maxPanelH: clamp(minSide * 0.35, 160, 320),
    };
  }, [baseFrame.width, baseFrame.height]);

  const borderColor = error ? colors.danger600 : open ? colors.primary600 : colors.border;

  const selected = list.find((it) => it.value === value);

  const selectValue = (v: Primitive) => {
    if (allowDeselect && v === value) {
      onChange?.(undefined);
      setOpen(false);
      return;
    }
    onChange?.(v);
    setOpen(false);
  };

  const clearValue = () => {
    onChange?.(undefined);
    setOpen(false);
  };

  return (
    <View style={style}>
      {/* Header */}
      <Pressable
        disabled={disabled}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        style={{
          minHeight: dims.minH,
          borderWidth: 1,
          borderColor,
          borderRadius: dims.radius,
          backgroundColor: disabled ? "#F2F2F2" : colors.neutral0,
          paddingHorizontal: dims.padH,
          paddingVertical: dims.padV,
          justifyContent: "center",
        }}
      >
        <Body
          frame={baseFrame}
          size="md"
          style={[
            {
              color: selected ? colors.textPrimary : colors.textSecondary,
            },
            textStyle,
          ]}
        >
          {selected ? selected.label : placeholder}
        </Body>
      </Pressable>

      {/* Panel */}
      {open && !disabled ? (
        <View
          style={{
            marginTop: 6,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: dims.radius,
            backgroundColor: colors.neutral0,
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowRadius: 6,
            elevation: 2,
            overflow: "hidden",
          }}
        >
          <ScrollView
            style={{ maxHeight: dims.maxPanelH }}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {showNoneOption ? (
              <Pressable
                key="__none__"
                onPress={clearValue}
                style={{
                  paddingVertical: dims.optionPadV,
                  paddingHorizontal: dims.optionPadH,
                  backgroundColor: value == null ? "rgba(45,138,36,0.08)" : "transparent",
                }}
              >
                <Body
                  frame={baseFrame}
                  size="md"
                  style={{
                    color: value == null ? colors.primary600 : colors.textPrimary,
                  }}
                >
                  {noneLabel}
                </Body>
              </Pressable>
            ) : null}

            {list.map((it) => {
              const active = it.value === value;
              return (
                <Pressable
                  key={`${typeof it.value}:${String(it.value)}`}
                  onPress={() => selectValue(it.value)}
                  style={{
                    paddingVertical: dims.optionPadV,
                    paddingHorizontal: dims.optionPadH,
                    backgroundColor: active ? "rgba(45,138,36,0.08)" : "transparent",
                  }}
                >
                  <Body
                    frame={baseFrame}
                    size="md"
                    style={{
                      color: active ? colors.primary600 : colors.textPrimary,
                    }}
                  >
                    {it.label}
                  </Body>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
};

export default DatasetSelect;
