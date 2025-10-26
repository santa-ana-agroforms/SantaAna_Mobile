import { Body } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  Platform,
  Pressable,
  Text,
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
  formatLabel?: (v: Primitive) => string;
  title?: string;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const defaultLabel = (v: Primitive) => (typeof v === "boolean" ? (v ? "Sí" : "No") : String(v));
const eqValue = (a: Primitive | undefined, b: Primitive | undefined) => String(a) === String(b);

const normalize = (arr?: Item[], fmt?: (v: Primitive) => string) => {
  const out: { label: string; value: Primitive }[] = [];
  const seen = new Set<string>();
  for (const it of arr ?? []) {
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
  title = "Seleccionar",
}) => {
  const { width: ww, height: hh } = useWindowDimensions();
  const baseFrame = frame ?? { width: ww, height: hh };

  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<Primitive | undefined>(value);
  useEffect(() => {
    if (isControlled) setInternalValue(value);
  }, [isControlled, value]);
  const currentValue = isControlled ? value : internalValue;

  const list = useMemo(() => normalize(items, formatLabel), [items, formatLabel]);
  const data = useMemo(() => {
    const head = showNoneOption ? [{ label: noneLabel, value: "__NONE__" as Primitive }] : [];
    return [...head, ...list];
  }, [list, showNoneOption, noneLabel]);

  const dims = useMemo(() => {
    const minSide = Math.min(baseFrame.width, baseFrame.height);
    const baseRem = clamp(minSide * 0.042, 14, 18);
    return {
      radius: clamp(minSide * 0.018, 8, 12),
      padH: clamp(minSide * 0.014, 12, 18),
      padV: clamp(minSide * 0.01, 8, 14),
      minH: clamp(minSide * 0.06, 44, 62),
      font: clamp(baseRem * 1.05, 14, 20),
      sheetMaxH: Math.round(baseFrame.height * 0.6),
    };
  }, [baseFrame.width, baseFrame.height]);

  const borderColor = error ? colors.danger600 : colors.border;

  const selected = useMemo(
    () => list.find((it) => eqValue(it.value, currentValue)),
    [list, currentValue]
  );

  const headerLabel =
    selected?.label ??
    (currentValue != null && currentValue !== undefined
      ? (formatLabel ? formatLabel(currentValue) : defaultLabel(currentValue)) || placeholder
      : placeholder);

  const setValue = (v: Primitive | undefined) => {
    if (!isControlled) setInternalValue(v);
    onChange?.(v);
  };

  /* ──────────────────────────
   *  Modal + Animaciones
   * ────────────────────────── */
  const [open, setOpen] = useState(false);
  const backdrop = useRef(new Animated.Value(0)).current; // 0 → transparente, 1 → oscuro
  const sheetY = useRef(new Animated.Value(1)).current; // 1 → fuera abajo, 0 → visible

  const openWithAnim = () => {
    setOpen(true); // montar modal primero
  };
  const closeWithAnim = () => {
    // animación de salida
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetY, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setOpen(false);
    });
  };

  // Dispara la animación de entrada cuando open cambia a true
  useEffect(() => {
    if (!open) return;
    backdrop.setValue(0);
    sheetY.setValue(1);
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetY, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [open, backdrop, sheetY]);

  // Interpolaciones
  const backdropStyle = {
    opacity: backdrop.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }),
  };
  const sheetTranslate = {
    transform: [
      {
        translateY: sheetY.interpolate({
          inputRange: [0, 1],
          outputRange: [0, dims.sheetMaxH + 40], // sale desde abajo
        }),
      },
    ],
  };

  const handleSelect = (raw: Primitive) => {
    if (String(raw) === "__NONE__") {
      setValue(undefined);
      closeWithAnim();
      return;
    }
    if (allowDeselect && eqValue(raw, currentValue)) {
      closeWithAnim();
      return;
    }
    setValue(raw);
    closeWithAnim();
  };

  return (
    <View style={style}>
      {/* Header botón */}
      <Pressable disabled={disabled} onPress={openWithAnim} accessibilityRole="button">
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

      {/* Modal: el fondo hace fade, el sheet sube desde abajo */}
      <Modal
        visible={open && !disabled}
        transparent
        animationType="none" // controlamos animación nosotros
        onRequestClose={closeWithAnim}
        statusBarTranslucent
      >
        {/* Backdrop oscuro con fade (no se mueve) */}
        <Animated.View
          style={[
            {
              flex: 1,
              backgroundColor: "#000",
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
            },
            backdropStyle,
          ]}
        />

        {/* Área clickeable para cerrar (fuera del sheet) */}
        <Pressable
          style={{ flex: 1 }}
          onPress={closeWithAnim}
          android_ripple={{ color: "transparent" }}
        />

        {/* Sheet: contenedor fijo abajo, solo este se anima desde abajo */}
        <Animated.View
          style={[
            {
              alignSelf: "stretch",
              backgroundColor: colors.neutral0,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: Platform.select({ ios: 24, android: 16 }),
              maxHeight: dims.sheetMaxH,
            },
            sheetTranslate,
          ]}
        >
          {!!title && (
            <Text
              style={{
                fontWeight: "900",
                fontSize: 16,
                color: colors.textPrimary,
                marginBottom: 8,
              }}
            >
              {title}
            </Text>
          )}

          <FlatList
            data={data}
            keyExtractor={(it) =>
              String(it.value) === "__NONE__"
                ? "__none__"
                : `${typeof it.value}:${String(it.value)}`
            }
            ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
            contentContainerStyle={{ paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isNone = String(item.value) === "__NONE__";
              const active = isNone ? currentValue == null : eqValue(item.value, currentValue);

              const baseBg = active ? "rgba(45,138,36,0.08)" : "rgba(0,0,0,0.03)";
              const pressedBg = active ? "rgba(45,138,36,0.12)" : "rgba(0,0,0,0.06)";
              const borderCol = active ? colors.primary600 : colors.border;

              return (
                <Pressable
                  onPress={() => handleSelect(item.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  {({ pressed }) => (
                    <View
                      style={{
                        minHeight: 44,
                        flexDirection: "row",
                        alignItems: "center",
                        borderRadius: 12,
                        backgroundColor: pressed ? pressedBg : baseBg,
                        borderWidth: 1,
                        borderColor: borderCol,
                        overflow: "hidden",
                      }}
                    >
                      {/* Barra lateral de selección (sin sombras) */}
                      <View
                        style={{
                          width: 8,
                          right: 0,
                          alignSelf: "stretch",
                          backgroundColor: active ? colors.primary600 : "transparent",
                        }}
                      />

                      {/* Texto */}
                      <Text
                        style={{
                          flex: 1,
                          paddingVertical: 12,
                          paddingHorizontal: 12,
                          color: active ? colors.primary600 : colors.textPrimary,
                          fontWeight: active ? "800" : "500",
                        }}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>

                      {/* Indicador circular (sin íconos) */}
                      <View
                        style={{
                          width: 16,
                          height: 16,
                          marginRight: 12,
                          borderRadius: 8,
                          borderWidth: 2,
                          borderColor: active ? colors.primary600 : colors.border,
                          backgroundColor: active ? colors.primary600 : "transparent",
                        }}
                      />
                    </View>
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={{ paddingVertical: 12 }}>
                <Text style={{ color: colors.textSecondary }}>Sin opciones</Text>
              </View>
            }
          />

          {/* Botón cerrar (tap fuera también cierra) */}
          <Pressable
            onPress={closeWithAnim}
            style={{
              marginTop: 8,
              alignSelf: "stretch",
              paddingVertical: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: "#F3F3F3",
            }}
          >
            <Text style={{ textAlign: "center", color: colors.textSecondary, fontWeight: "800" }}>
              Cerrar
            </Text>
          </Pressable>
        </Animated.View>
      </Modal>
    </View>
  );
};

export default DatasetSelect;
