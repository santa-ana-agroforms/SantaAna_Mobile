// src/components/atoms/DateTimeField.tsx
import { Body } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

type Frame = { width: number; height: number };

type Props = {
  mode: "date" | "time";
  value?: Date | null;
  onChange?: (d: Date | null) => void;
  label?: string;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  error?: string;
  /** Escala visual (usa el lado menor). Recomendado: referenceFrame de PageScaffold */
  frame?: Frame;
  clearable?: boolean;
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const formatDate = (d: Date) =>
  `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const formatTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const DateTimeField: React.FC<Props> = ({
  mode,
  value,
  onChange,
  label,
  placeholder,
  minDate,
  maxDate,
  disabled = false,
  error,
  frame,
  clearable = true,
}) => {
  // Fallback si no pasan frame
  const { width: ww, height: hh } = useWindowDimensions();
  const baseFrame = useMemo(
    () => frame ?? { width: ww, height: hh },
    [frame, ww, hh],
  );
  const isIOS = Platform.OS === "ios";

  const dims = useMemo(() => {
    const minSide = Math.min(baseFrame.width, baseFrame.height);
    const baseRem = clamp(minSide * 0.042, 14, 18);

    const radius = clamp(minSide * 0.018, 8, 12);
    const padH = clamp(minSide * 0.014, 12, 18);
    const padV = clamp(minSide * 0.01, 8, 14);
    const font = clamp(baseRem * 1.05, 14, 20);
    const labelMb = clamp(minSide * 0.008, 6, 12);
    const errorMt = clamp(minSide * 0.006, 4, 8);

    // Panel modal iOS
    const panelPad = clamp(minSide * 0.02, 12, 20);
    const panelRadius = clamp(minSide * 0.02, 12, 18);
    const panelGap = clamp(minSide * 0.012, 8, 14);
    const btnH = clamp(minSide * 0.06, 40, 52);
    const maxPanelH = clamp(minSide * 0.7, 260, 420);

    return {
      radius,
      padH,
      padV,
      font,
      labelMb,
      errorMt,
      panelPad,
      panelRadius,
      panelGap,
      btnH,
      maxPanelH,
      baseRem,
    };
  }, [baseFrame]);

  const borderColor = disabled
    ? colors.neutral200
    : error
      ? colors.danger600
      : colors.border;

  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<Date>(value ?? new Date());

  const show = () => {
    if (disabled) return;
    setTemp(value ?? new Date());
    setOpen(true);
  };

  const hide = () => setOpen(false);

  const commit = (d: Date | null) => {
    onChange?.(d);
    hide();
  };

  const onAndroidChange = (e: DateTimePickerEvent, d?: Date) => {
    // Android muestra un diálogo nativo
    if (e.type === "set" && d) {
      commit(d);
    } else {
      hide();
    }
  };

  const onIOSChange = (_e: DateTimePickerEvent, d?: Date) => {
    if (d) setTemp(d); // sólo actualizamos el temporal, se confirma con "OK"
  };

  const text = value
    ? mode === "date"
      ? formatDate(value)
      : formatTime(value)
    : (placeholder ??
      (mode === "date" ? "Seleccionar fecha" : "Seleccionar hora"));

  return (
    <View style={{ width: "100%" }}>
      {label ? (
        <Body
          weight="semibold"
          size="sm"
          style={{ marginBottom: dims.labelMb, color: colors.textTertiary }}
        >
          {label}
        </Body>
      ) : null}

      {/* Caja presionable (estilo Input) */}
      <Pressable
        onPress={show}
        disabled={disabled}
        style={{
          borderColor,
          borderWidth: 1,
          borderRadius: dims.radius,
          backgroundColor: disabled ? "#F2F2F2" : colors.neutral0,
          paddingHorizontal: dims.padH,
          paddingVertical: dims.padV,
          minHeight: clamp(baseFrame.height * 0.06, 44, 62),
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: dims.font,
            color: value ? colors.textPrimary : colors.textSecondary,
            includeFontPadding: false,
          }}
        >
          {text}
        </Text>
      </Pressable>

      {/* Borrar selección */}
      {clearable && !!value && !disabled ? (
        <Pressable
          onPress={() => commit(null)}
          style={{
            alignSelf: "flex-end",
            marginTop: 6,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
          accessibilityRole="button"
          accessibilityLabel="Limpiar fecha/hora"
        >
          <Body color="secondary" size="xs" style={{ color: colors.danger600 }}>
            Limpiar
          </Body>
        </Pressable>
      ) : null}

      {/* Error */}
      {error ? (
        <Body
          size="xs"
          style={{ color: colors.danger600, marginTop: dims.errorMt }}
        >
          {error}
        </Body>
      ) : null}

      {/* Picker */}
      {open && !isIOS ? (
        <DateTimePicker
          value={temp}
          mode={mode}
          display={mode === "date" ? "calendar" : "clock"}
          onChange={onAndroidChange}
          minimumDate={minDate}
          maximumDate={maxDate}
        />
      ) : null}

      {/* iOS: modal con panel y botones */}
      {isIOS ? (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={hide}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.25)",
              alignItems: "center",
              justifyContent: "center",
              padding: dims.panelPad,
            }}
          >
            <View
              style={{
                width: "100%",
                borderRadius: dims.panelRadius,
                backgroundColor: colors.neutral0,
                padding: dims.panelPad,
                gap: dims.panelGap,
              }}
            >
              <Body weight="semibold">
                {mode === "date"
                  ? "Selecciona una fecha"
                  : "Selecciona una hora"}
              </Body>

              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: dims.radius,
                  padding: 6,
                  alignItems: "center",
                }}
              >
                <DateTimePicker
                  value={temp}
                  mode={mode}
                  display="spinner"
                  onChange={onIOSChange}
                  minimumDate={minDate}
                  maximumDate={maxDate}
                  style={{ width: "100%", maxHeight: dims.maxPanelH }}
                />
              </View>

              <View style={{ flexDirection: "row", gap: dims.panelGap }}>
                <Pressable
                  onPress={hide}
                  style={{
                    flex: 1,
                    height: dims.btnH,
                    borderRadius: dims.radius,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.neutral0,
                  }}
                >
                  <Body>Cancelar</Body>
                </Pressable>

                <Pressable
                  onPress={() => commit(temp)}
                  style={{
                    flex: 1,
                    height: dims.btnH,
                    borderRadius: dims.radius,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.primary600,
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
      ) : null}
    </View>
  );
};

export default DateTimeField;
