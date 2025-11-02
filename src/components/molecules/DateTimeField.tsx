import { Body } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import Label from "../atoms/Label";

type Frame = { width: number; height: number };

type Props = {
  mode: "date" | "time";
  value?: Date | null;
  onChange?: (d: Date | null) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  error?: string;
  frame?: Frame;
  clearable?: boolean;
};

const isValidDate = (d: unknown): d is Date => d instanceof Date && !isNaN(d.getTime());

const DateTimeField: React.FC<Props> = ({
  mode,
  value,
  onChange,
  label,
  required,
  placeholder,
  minDate,
  maxDate,
  disabled = false,
  error,
  frame,
  clearable = true,
}) => {
  const { width: ww, height: hh } = useWindowDimensions();
  const isIOS = Platform.OS === "ios";

  const dims = useMemo(() => {
    const baseFrame = frame ?? { width: ww, height: hh };
    const minSide = Math.min(baseFrame.width, baseFrame.height);
    return {
      radius: minSide * 0.018,
      padH: minSide * 0.03,
      padV: minSide * 0.01,
      font: minSide * 0.042,
      errorMt: minSide * 0.006,
      panelPad: minSide * 0.02,
      panelRadius: minSide * 0.02,
      panelGap: minSide * 0.012,
      btnH: minSide * 0.06,
      maxPanelH: minSide * 0.7,
      minHeight: baseFrame.height * 0.06,
    };
  }, [frame, ww, hh]);

  const [open, setOpen] = useState(false);
  const safeValue = isValidDate(value) ? value : null;
  const [temp, setTemp] = useState<Date>(safeValue ?? new Date());
  const [optimistic, setOptimistic] = useState<Date | null>(null);

  const justClosedAtRef = useRef(0);

  useEffect(() => {
    if (isValidDate(safeValue)) {
      setTemp(safeValue);
      setOptimistic(null); // llegó valor oficial → limpia optimista
    }
  }, [safeValue, value, mode]);

  const borderColor = disabled ? colors.neutral200 : error ? colors.danger600 : colors.border;

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "2-digit", year: "numeric" }),
    []
  );
  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }),
    []
  );

  // Mostrar: SIEMPRE usa safeValue u optimista (no mostrar 'temp')
  const display = safeValue ?? optimistic;
  const text = display
    ? mode === "date"
      ? dateFmt.format(display)
      : timeFmt.format(display)
    : (placeholder ?? (mode === "date" ? "Seleccionar fecha" : "Seleccionar hora"));

  const handleOpen = () => {
    if (disabled) return;
    const now = Date.now();
    if (now - justClosedAtRef.current < 250) return;
    const next = safeValue ?? optimistic ?? new Date();
    setTemp(next);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    justClosedAtRef.current = Date.now();
  };

  // Commit optimista (no mostramos temp; solo sirve para el picker)
  const notify = (d: Date | null) => {
    setOptimistic(d);
    if (onChange) onChange(d);
    handleClose();
  };

  // Android: selecciona / cancela
  const handleAndroidChange = (e: DateTimePickerEvent, d?: Date) => {
    if (e.type === "set" && d) {
      notify(d);
    } else {
      handleClose();
    }
  };

  // iOS: mueve spinner (preview)
  const handleIOSChange = (_e: DateTimePickerEvent, d?: Date) => {
    if (d) setTemp(d);
  };

  return (
    <View style={{ width: "100%" }}>
      <Label frame={frame} text={label} required={required} />
      <Pressable
        onPress={handleOpen}
        disabled={disabled}
        style={{
          borderColor,
          borderWidth: 1,
          borderRadius: dims.radius,
          backgroundColor: disabled ? "#F2F2F2" : colors.neutral0,
          paddingHorizontal: dims.padH,
          paddingVertical: dims.padV,
          minHeight: dims.minHeight,
          justifyContent: "center",
        }}
        accessibilityRole="button"
        accessibilityLabel={label ?? (mode === "date" ? "Seleccionar fecha" : "Seleccionar hora")}
      >
        <Text
          testID="DateTimeFieldText"
          allowFontScaling={false}
          style={{
            fontSize: dims.font,
            color: display ? colors.textPrimary : colors.textSecondary,
            includeFontPadding: false,
          }}
        >
          {text}
        </Text>
      </Pressable>

      {clearable && !!display && !disabled && (
        <Pressable
          onPress={() => {
            setOptimistic(null);
            notify(null);
          }}
          style={{
            alignSelf: "flex-end",
            marginTop: dims.errorMt,
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
      )}

      {error && (
        <Body size="xs" style={{ color: colors.danger600, marginTop: dims.errorMt }}>
          {error}
        </Body>
      )}

      {/* Android: diálogo nativo simple */}
      {open && !isIOS && (
        <DateTimePicker
          value={temp}
          mode={mode}
          display={mode === "date" ? "calendar" : "clock"}
          onChange={handleAndroidChange}
          minimumDate={minDate}
          maximumDate={maxDate}
        />
      )}

      {/* iOS: modal con confirmación */}
      {isIOS && (
        <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
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
                {mode === "date" ? "Selecciona una fecha" : "Selecciona una hora"}
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
                  onChange={handleIOSChange}
                  minimumDate={minDate}
                  maximumDate={maxDate}
                  style={{ width: "100%", maxHeight: dims.maxPanelH }}
                />
              </View>

              <View style={{ flexDirection: "row", gap: dims.panelGap }}>
                <Pressable
                  onPress={handleClose}
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
                  onPress={() => notify(temp)}
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
      )}
    </View>
  );
};

export default DateTimeField;
