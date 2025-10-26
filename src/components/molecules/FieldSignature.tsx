import Button from "@/components/atoms/Button";
import SignaturePad, { type SignaturePadHandle } from "@/components/atoms/SignaturePad";
import { colors } from "@/theme/tokens";
import React, { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";

type Frame = { width: number; height: number };

type Props = {
  referenceFrame: Frame;
  contentFrame: Frame;
  onChange?: (data: { strokes: any[]; image?: string }) => void;
  initialLocked?: boolean;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const FieldSignature: React.FC<Props> = ({ referenceFrame, onChange, initialLocked = true }) => {
  const ref = useRef<SignaturePadHandle>(null);
  const [locked, setLocked] = useState(initialLocked);
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "err" } | null>(null);

  const minSide = Math.min(referenceFrame.width, referenceFrame.height);
  const pad = clamp(minSide * 0.02, 12, 20);
  const height = clamp(minSide * 0.5, 140, 260);
  const tbGap = clamp(minSide * 0.012, 6, 12);
  const toastPadH = clamp(minSide * 0.012, 8, 14);
  const toastPadV = clamp(minSide * 0.008, 6, 10);
  const toastRadius = clamp(minSide * 0.018, 8, 12);

  const showToast = (text: string, kind: "ok" | "err" = "ok") => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 1600);
  };

  const handleConfirm = async () => {
    const empty = ref.current?.isEmpty?.();
    if (empty) {
      showToast("Dibuja tu firma primero", "err");
      return;
    }

    try {
      const base64 = await ref.current!.exportImage({
        format: "png",
        result: "base64",
        quality: 1,
        scale: 1, // ahora 1 = tamaño visual exacto; 2 = el doble de resolución
        backgroundColor: "#FFF",
      });

      onChange?.({
        strokes: [],
        image: `data:image/png;base64,${base64}`,
        // meta, // ← si tu tipo lo permite
      });

      setLocked(true);
      showToast("Firma guardada", "ok");
    } catch (e) {
      console.error("Exportar firma falló:", e);
      showToast("No se pudo exportar la firma", "err");
    }
  };

  // Callback estable para evitar recrearse y causar renders en cadena
  const handleStrokes = useCallback(
    (strokes: any[]) => {
      if (!strokes || strokes.length === 0) return;
      onChange?.({ strokes });
    },
    [onChange]
  );

  return (
    <View style={{ width: "100%" }}>
      <View style={{ position: "relative" }}>
        <SignaturePad
          ref={ref}
          width={"100%"}
          height={height}
          strokeColor={colors.textPrimary}
          strokeWidth={2.5}
          onChangeStrokes={handleStrokes}
          disabled={locked}
        />

        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: pad,
            right: pad,
            bottom: pad,
          }}
        >
          {toast ? (
            <View
              style={{
                alignSelf: "center",
                backgroundColor:
                  toast.kind === "ok" ? "rgba(0,128,0,0.12)" : "rgba(192,57,43,0.12)",
                borderColor: toast.kind === "ok" ? "rgba(0,128,0,0.28)" : "rgba(192,57,43,0.28)",
                borderWidth: 1,
                paddingHorizontal: toastPadH,
                paddingVertical: toastPadV,
                borderRadius: toastRadius,
                marginBottom: tbGap,
              }}
            >
              <Text
                allowFontScaling={false}
                style={{
                  color: toast.kind === "ok" ? colors.textPrimary : colors.danger600,
                  fontSize: clamp(minSide * 0.038, 12, 16),
                }}
              >
                {toast.text}
              </Text>
            </View>
          ) : null}

          <View style={{ alignSelf: "flex-end", flexDirection: "row", gap: tbGap }}>
            {!locked ? (
              <Button title="Confirmar" size="sm" onPress={handleConfirm} />
            ) : (
              <Button title="Editar" size="sm" variant="ghost" onPress={() => setLocked(false)} />
            )}
          </View>
        </View>
      </View>

      {!locked && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            gap: pad,
            marginTop: pad * 0.6,
          }}
        >
          <Button title="Limpiar" size="sm" variant="ghost" onPress={() => ref.current?.clear()} />
          <Button title="Deshacer" size="sm" variant="ghost" onPress={() => ref.current?.undo()} />
        </View>
      )}
    </View>
  );
};

export default FieldSignature;
