import { Body } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import React, { useMemo, useState } from "react";
import { Modal, Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import Label from "../atoms/Label";

type Frame = { width: number; height: number };

type Props = {
  mode: "date" | "time";
  value?: Date | null;
  onChange: (d: Date | null) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  frame?: Frame; // Frame para calcular escalas
  disabled?: boolean;
  clearable?: boolean;
};

const DateTimeField: React.FC<Props> = ({
  mode,
  value,
  onChange,
  label,
  required,
  placeholder,
  frame,
  disabled = false,
  clearable = true,
}) => {
  // 1. Lógica Responsive (dims) restaurada y optimizada
  const { width: ww, height: hh } = useWindowDimensions();

  const dims = useMemo(() => {
    // Si viene frame usamos ese, si no, dimensiones de ventana
    const baseW = frame?.width ?? ww;
    const baseH = frame?.height ?? hh;
    const minSide = Math.min(baseW, baseH);

    // Factores de escala (ajustados ligeramente para consistencia)
    return {
      radius: minSide * 0.018,
      padH: minSide * 0.03,
      padV: minSide * 0.03, // Unificado vertical
      font: minSide * 0.05,
      btnH: minSide * 0.09, // Botones iOS un poco más altos para tacto
      gap: minSide * 0.02,
    };
  }, [frame, ww, hh]);

  // 2. Estado simplificado (Solo lo necesario para controlar UI)
  const [show, setShow] = useState(false);
  const [iosTemp, setIosTemp] = useState<Date>(new Date());

  const isIOS = Platform.OS === "ios";
  const displayValue = value instanceof Date && !isNaN(value.getTime()) ? value : null;

  // Formateador visual
  const displayText = displayValue
    ? mode === "date"
      ? displayValue.toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : displayValue.toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
    : placeholder || "Seleccionar";

  const handleOpen = () => {
    if (disabled) return;
    setIosTemp(displayValue || new Date());
    setShow(true);
  };

  const onAndroidChange = (e: DateTimePickerEvent, selectedDate?: Date) => {
    setShow(false);
    if (e.type === "set" && selectedDate) {
      onChange(selectedDate);
    }
  };

  return (
    <View style={{ width: "100%" }}>
      <Label frame={frame} text={label} required={required} />

      <Pressable
        onPress={handleOpen}
        style={{
          borderWidth: 1,
          borderColor: disabled ? colors.neutral200 : colors.border,
          borderRadius: dims.radius,
          backgroundColor: disabled ? "#F2F2F2" : colors.neutral0,
          paddingHorizontal: dims.padH,
          paddingVertical: dims.padV,
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: dims.font,
            color: displayValue ? colors.textPrimary : colors.textSecondary,
          }}
        >
          {displayText}
        </Text>
      </Pressable>

      {/* Botón limpiar responsive */}
      {clearable && displayValue && !disabled && (
        <Pressable
          onPress={() => onChange(null)}
          style={{ alignSelf: "flex-end", marginTop: dims.gap / 2, padding: 4 }}
        >
          <Body size="xs" style={{ color: colors.danger600 }}>
            Limpiar
          </Body>
        </Pressable>
      )}

      {/* Selector Nativo Android */}
      {!isIOS && show && (
        <DateTimePicker
          value={displayValue || new Date()}
          mode={mode}
          display="default"
          onChange={onAndroidChange}
        />
      )}

      {/* Modal iOS Responsive */}
      {isIOS && (
        <Modal
          visible={show}
          transparent
          animationType="fade"
          onRequestClose={() => setShow(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.3)",
              justifyContent: "center",
              padding: dims.padH,
            }}
          >
            <View
              style={{ backgroundColor: "white", borderRadius: dims.radius, padding: dims.padH }}
            >
              <Body weight="semibold" style={{ marginBottom: dims.gap, textAlign: "center" }}>
                {mode === "date" ? "Selecciona fecha" : "Selecciona hora"}
              </Body>

              <View style={{ height: 150, width: "100%", justifyContent: "center" }}>
                <DateTimePicker
                  value={iosTemp}
                  mode={mode}
                  display="spinner"
                  onChange={(_, d) => d && setIosTemp(d)}
                  style={{ flex: 1 }}
                />
              </View>

              <View style={{ flexDirection: "row", gap: dims.gap, marginTop: dims.gap }}>
                <Pressable
                  onPress={() => setShow(false)}
                  style={{
                    flex: 1,
                    height: dims.btnH,
                    borderRadius: dims.radius,
                    borderWidth: 1,
                    borderColor: colors.border,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Body>Cancelar</Body>
                </Pressable>

                <Pressable
                  onPress={() => {
                    onChange(iosTemp);
                    setShow(false);
                  }}
                  style={{
                    flex: 1,
                    height: dims.btnH,
                    borderRadius: dims.radius,
                    backgroundColor: colors.primary600,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Body color="inverse" weight="semibold">
                    OK
                  </Body>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

export default DateTimeField;
