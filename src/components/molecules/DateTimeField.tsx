// src/components/atoms/DateTimeField.tsx
import { Body } from "@/components/atoms/Typography";
import { colors } from "@/theme/tokens";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import React, { useMemo, useRef, useState } from "react";
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

const DEBUG = true; // ← activa/desactiva logs de este componente

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const formatDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const formatTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

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
  const baseFrame = useMemo(() => frame ?? { width: ww, height: hh }, [frame, ww, hh]);
  const isIOS = Platform.OS === "ios";

  const dims = useMemo(() => {
    const minSide = Math.min(baseFrame.width, baseFrame.height);
    const baseRem = clamp(minSide * 0.042, 14, 18);
    return {
      radius: clamp(minSide * 0.018, 8, 12),
      padH: clamp(minSide * 0.014, 12, 18),
      padV: clamp(minSide * 0.01, 8, 14),
      font: clamp(baseRem * 1.05, 14, 20),
      labelMb: clamp(minSide * 0.008, 6, 12),
      errorMt: clamp(minSide * 0.006, 4, 8),
      panelPad: clamp(minSide * 0.02, 12, 20),
      panelRadius: clamp(minSide * 0.02, 12, 18),
      panelGap: clamp(minSide * 0.012, 8, 14),
      btnH: clamp(minSide * 0.06, 40, 52),
      maxPanelH: clamp(minSide * 0.7, 260, 420),
      baseRem,
    };
  }, [baseFrame]);

  const borderColor = disabled ? colors.neutral200 : error ? colors.danger600 : colors.border;

  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<Date>(value ?? new Date());
  const justClosedAtRef = useRef<number>(0);

  const isValidDate = (d: unknown): d is Date => d instanceof Date && !isNaN(d.getTime());
  const safeValue = useMemo(() => (isValidDate(value) ? value : null), [value]);

  React.useEffect(() => {
    if (DEBUG) {
      console.log("[DTF] effect:value→temp", {
        mode,
        valueType: value ? value.constructor.name : value,
        valueSafe: safeValue?.toString?.(),
        valueISO: safeValue?.toISOString?.(),
      });
    }
    setTemp(safeValue ?? new Date());
  }, [safeValue, mode]);

  const show = () => {
    if (disabled) return;
    const now = Date.now();
    if (now - justClosedAtRef.current < 300) {
      if (DEBUG) console.log("[DTF] show blocked by debounce");
      return;
    }
    if (DEBUG) {
      console.log("[DTF] show()", {
        mode,
        safeValue: safeValue?.toString?.(),
        safeValueISO: safeValue?.toISOString?.(),
      });
    }
    setTemp(safeValue ?? new Date());
    setOpen(true);
  };

  const hide = () => {
    if (DEBUG) console.log("[DTF] hide()");
    setOpen(false);
    justClosedAtRef.current = Date.now();
  };

  const commit = (d: Date | null) => {
    if (DEBUG) {
      console.log("[DTF] commit()", {
        mode,
        commitLocal: d?.toString?.(),
        commitISO: d?.toISOString?.(),
      });
    }
    hide();
    setTimeout(() => {
      if (DEBUG) console.log("[DTF] onChange() call (deferred)");
      onChange?.(d);
    }, 0);
  };

  const onAndroidChange = (e: DateTimePickerEvent, d?: Date) => {
    if (DEBUG) {
      console.log("[DTF] onAndroidChange", {
        mode,
        type: e.type,
        nativeEvent: e.nativeEvent,
        pickLocal: d?.toString?.(),
        pickISO: d?.toISOString?.(),
      });
    }
    if (e.type === "set" && d) commit(d);
    else hide();
  };

  // const onIOSChange = (_e: DateTimePickerEvent, d?: Date) => {
  //   if (d) {
  //     if (DEBUG) console.log("[DTF] onIOSChange temp←", d.toString());
  //     setTemp(d);
  //   }
  // };

  // Lo que realmente se muestra en el texto
  const shown = open ? temp : safeValue;
  const hasValue = !!shown;
  const text = shown
    ? mode === "date"
      ? formatDate(shown)
      : formatTime(shown)
    : (placeholder ?? (mode === "date" ? "Seleccionar fecha" : "Seleccionar hora"));

  if (DEBUG) {
    console.log("[DTF] render", {
      mode,
      open,
      hasValue,
      safeValueLocal: safeValue?.toString?.(),
      safeValueISO: safeValue?.toISOString?.(),
      tempLocal: temp?.toString?.(),
      tempISO: temp?.toISOString?.(),
      text,
    });
  }

  return (
    <View style={{ width: "100%" }}>
      <Label frame={frame} text={label} required={required} />
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
          allowFontScaling={false}
          style={{
            fontSize: dims.font,
            color: hasValue ? colors.textPrimary : colors.textSecondary,
            includeFontPadding: false,
          }}
        >
          {text}
        </Text>
      </Pressable>

      {clearable && !!value && !disabled ? (
        <Pressable
          onPress={() => commit(null)}
          style={{ alignSelf: "flex-end", marginTop: 6, paddingHorizontal: 6, paddingVertical: 2 }}
          accessibilityRole="button"
          accessibilityLabel="Limpiar fecha/hora"
        >
          <Body color="secondary" size="xs" style={{ color: colors.danger600 }}>
            Limpiar
          </Body>
        </Pressable>
      ) : null}

      {error ? (
        <Body size="xs" style={{ color: colors.danger600, marginTop: dims.errorMt }}>
          {error}
        </Body>
      ) : null}

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

      {isIOS ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={hide}>
          {/* ... (sin cambios visuales) ... */}
        </Modal>
      ) : null}
    </View>
  );
};

export default DateTimeField;
