// src/components/molecules/FieldSignature.tsx
import Button from "@/components/atoms/Button";
import SignaturePad, {
  type SignaturePadHandle,
} from "@/components/atoms/SignaturePad";
import { colors } from "@/theme/tokens";
import React, { useRef, useState } from "react";
import { Text, View } from "react-native";

type Frame = { width: number; height: number };

type Props = {
  referenceFrame: Frame;
  contentFrame: Frame;
  onChange?: (data: { strokes: any[]; image?: string }) => void;
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const FieldSignature: React.FC<Props> = ({
  referenceFrame,
  contentFrame,
  onChange,
}) => {
  const ref = useRef<SignaturePadHandle>(null);
  const [locked, setLocked] = useState(false);
  const [toast, setToast] = useState<{
    text: string;
    kind: "ok" | "err";
  } | null>(null);

  // Escalas responsivas
  const minSide = Math.min(referenceFrame.width, referenceFrame.height);
  const pad = clamp(minSide * 0.02, 12, 20);
  const height = clamp(minSide * 0.5, 140, 260);

  // Toolbar interna (dentro del lienzo)
  const tbGap = clamp(minSide * 0.012, 6, 12);
  const toastPadH = clamp(minSide * 0.012, 8, 14);
  const toastPadV = clamp(minSide * 0.008, 6, 10);
  const toastRadius = clamp(minSide * 0.018, 8, 12);

  const showToast = (text: string, kind: "ok" | "err" = "ok") => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 1600);
  };

  const handleConfirm = async () => {
    const empty = await ref.current?.isEmpty?.();
    if (empty) {
      showToast("Dibuja tu firma primero", "err");
      return;
    }
    setLocked(true);
  };

  return (
    <View style={{ width: contentFrame.width }}>
      <View style={{ position: "relative" }}>
        {/* Lienzo */}
        <SignaturePad
          ref={ref}
          width={contentFrame.width}
          height={height}
          strokeColor={colors.textPrimary}
          strokeWidth={2.5}
          onChangeStrokes={(strokes: any[]) => onChange?.({ strokes })}
          disabled={locked}
        />

        {/* Overlay: toolbar + toasts */}
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: pad,
            right: pad,
            bottom: pad,
          }}
        >
          {/* Toast centrado */}
          {toast ? (
            <View
              style={{
                alignSelf: "center",
                backgroundColor:
                  toast.kind === "ok"
                    ? "rgba(0,128,0,0.12)"
                    : "rgba(192,57,43,0.12)",
                borderColor:
                  toast.kind === "ok"
                    ? "rgba(0,128,0,0.28)"
                    : "rgba(192,57,43,0.28)",
                borderWidth: 1,
                paddingHorizontal: toastPadH,
                paddingVertical: toastPadV,
                borderRadius: toastRadius,
                marginBottom: tbGap,
              }}
            >
              <Text
                style={{
                  color:
                    toast.kind === "ok" ? colors.textPrimary : colors.danger600,
                  fontSize: clamp(minSide * 0.038, 12, 16),
                }}
              >
                {toast.text}
              </Text>
            </View>
          ) : null}

          {/* Toolbar (derecha) */}
          <View
            style={{ alignSelf: "flex-end", flexDirection: "row", gap: tbGap }}
          >
            {!locked ? (
              <Button title="Confirmar" size="sm" onPress={handleConfirm} />
            ) : (
              <Button
                title="Editar"
                size="sm"
                variant="ghost"
                onPress={() => setLocked(false)}
              />
            )}
          </View>
        </View>
      </View>

      {/* Controles fuera (solo cuando NO está bloqueado) */}
      {!locked && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            gap: pad,
            marginTop: pad * 0.6,
          }}
        >
          <Button
            title="Limpiar"
            size="sm"
            variant="ghost"
            onPress={() => ref.current?.clear()}
          />
          <Button
            title="Deshacer"
            size="sm"
            variant="ghost"
            onPress={() => ref.current?.undo()}
          />
        </View>
      )}
    </View>
  );
};

export default FieldSignature;
