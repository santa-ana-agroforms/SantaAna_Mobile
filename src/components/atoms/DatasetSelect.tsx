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

    const key = `${typeof value}:${String(value)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, value });
  }
  return out;
};

const eqValue = (a: Primitive | undefined, b: Primitive | undefined) => String(a) === String(b);

const DatasetSelect: React.FC<Props> = (props) => {
  const {
    frame,
    value, // ← puede venir undefined en modo no controlado
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
  } = props;

  const { width: ww, height: hh } = useWindowDimensions();
  const baseFrame = frame ?? { width: ww, height: hh };

  // Modo controlado / no controlado
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<Primitive | undefined>(value);
  React.useEffect(() => {
    if (isControlled) setInternalValue(value);
  }, [isControlled, value]);
  const currentValue = isControlled ? value : internalValue;

  const [open, setOpen] = useState(false);
  const list = useMemo(() => normalize(items, formatLabel), [items, formatLabel]);

  // Medidas + layout
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
      minSide,
    };
  }, [baseFrame.width, baseFrame.height]);

  const borderColor = error ? colors.danger600 : open ? colors.primary600 : colors.border;

  const selected = useMemo(
    () => list.find((it) => eqValue(it.value, currentValue)),
    [list, currentValue]
  );

  const headerLabel = selected
    ? selected.label
    : currentValue != null
      ? formatLabel
        ? formatLabel(currentValue)
        : defaultLabel(currentValue)
      : placeholder;

  const setValue = (v: Primitive | undefined) => {
    console.log("DatasetSelect setValue:", v);
    if (!isControlled) setInternalValue(v);
    onChange?.(v);
  };

  const selectValue = (v: Primitive) => {
    console.log("DatasetSelect selectValue:", v);
    if (allowDeselect && eqValue(v, currentValue)) {
      setValue(undefined);
      setOpen(false);
      return;
    }
    setValue(v);
    setOpen(false);
  };

  const clearValue = () => {
    setValue(undefined);
    setOpen(false);
  };

  // Visibilidad de barra y hint “Desliza…”
  const [containerH, setContainerH] = React.useState(0);
  const [contentH, setContentH] = React.useState(0);
  const canScroll = contentH > containerH + 1;

  return (
    <View style={style}>
      {/* Header */}
      <Pressable disabled={disabled} onPress={() => setOpen((v) => !v)} accessibilityRole="button">
        {({ pressed }) => (
          <View
            style={{
              minHeight: dims.minH,
              borderWidth: 1,
              borderColor,
              borderRadius: dims.radius,
              backgroundColor: disabled
                ? "#F2F2F2"
                : pressed
                  ? "rgba(0,0,0,0.04)"
                  : colors.neutral0,
              paddingHorizontal: dims.padH,
              paddingVertical: dims.padV,
              justifyContent: "center",
              transform: [{ scale: pressed ? 0.98 : 1 }],
            }}
          >
            <Body
              frame={baseFrame}
              size="md"
              style={[{ color: selected ? colors.textPrimary : colors.textSecondary }, textStyle]}
            >
              {headerLabel}
            </Body>
          </View>
        )}
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
            position: "relative", // para overlay del hint
          }}
        >
          <ScrollView
            style={{ maxHeight: dims.maxPanelH, paddingRight: 2 }}
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
            showsVerticalScrollIndicator
            persistentScrollbar
            indicatorStyle="black"
            scrollIndicatorInsets={{ right: 2 }}
            onLayout={(e) => setContainerH(e.nativeEvent.layout.height)}
            onContentSizeChange={(_, h) => setContentH(h)}
          >
            {showNoneOption ? (
              <Pressable
                key="__none__"
                onPress={clearValue}
                android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: false }}
                pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                {({ pressed }) => (
                  <View
                    style={{
                      paddingVertical: dims.optionPadV,
                      paddingHorizontal: dims.optionPadH,
                      backgroundColor: pressed
                        ? "rgba(45,138,36,0.15)"
                        : currentValue == null
                          ? "rgba(45,138,36,0.08)"
                          : "transparent",
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    }}
                  >
                    <Body
                      frame={baseFrame}
                      size="md"
                      style={{
                        color: currentValue == null ? colors.primary600 : colors.textPrimary,
                        opacity: pressed ? 0.9 : 1,
                      }}
                    >
                      {noneLabel}
                    </Body>
                  </View>
                )}
              </Pressable>
            ) : null}

            {list.map((it) => {
              const active = eqValue(it.value, currentValue);
              return (
                <Pressable
                  key={`${typeof it.value}:${String(it.value)}`}
                  onPress={() => selectValue(it.label)}
                  android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: false }}
                  pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  {({ pressed }) => (
                    <View
                      style={{
                        paddingVertical: dims.optionPadV,
                        paddingHorizontal: dims.optionPadH,
                        backgroundColor: pressed
                          ? "rgba(45,138,36,0.15)" // presionado
                          : active
                            ? "rgba(45,138,36,0.08)" // seleccionado
                            : "transparent",
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      }}
                    >
                      <Body
                        frame={baseFrame}
                        size="md"
                        style={{
                          color: active ? colors.primary600 : colors.textPrimary,
                          opacity: pressed ? 0.9 : 1,
                        }}
                      >
                        {it.label}
                      </Body>
                    </View>
                  )}
                </Pressable>
              );
            })}
            <View style={{ height: dims.minSide * 0.06 }} />
          </ScrollView>

          {/* Hint “Desliza para ver más” cuando hay overflow */}
          {canScroll ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                alignItems: "center",
                justifyContent: "flex-end",
                paddingVertical: 6,
                // leve fondo para sugerir continuidad
                backgroundColor: "rgba(255,255,255,0.85)",
              }}
            >
              <Body frame={baseFrame} size="xxs" style={{ color: colors.textSecondary }}>
                Desliza para ver más
              </Body>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

export default DatasetSelect;
