import Input from "@/components/atoms/Input"; // Ajusta la ruta a tu Input.tsx
import React, { useEffect, useState } from "react";

type Props = {
  value: number | null | undefined;
  onChange: (val: number | null) => void;
  // Pasamos el resto de props visuales (label, frame, etc)
  label?: string;
  required?: boolean;
  placeholder?: string;
  frame?: any;
  // Cualquier otra prop que acepte tu Input...
};

const NumericInput = ({ value, onChange, ...props }: Props) => {
  // 1. Estado local: almacena lo que el usuario ve (string)
  const [text, setText] = useState(value?.toString() ?? "");

  // 2. Estado de foco: CRÍTICO para evitar que se borre al escribir
  const [isFocused, setIsFocused] = useState(false);

  // 3. Sincronización: Props -> Estado Local
  // SOLO actualizamos el texto desde afuera si el usuario NO tiene el foco.
  // Esto protege lo que estás escribiendo de "reseteos" externos.
  useEffect(() => {
    if (!isFocused) {
      setText(value?.toString() ?? "");
    }
  }, [value, isFocused]);

  const handleBlur = () => {
    setIsFocused(false);

    // Normalización: cambiar comas por puntos (para teclados latinos)
    const normalized = text.replace(/,/g, ".").trim();

    // Caso 1: Vacío o caracteres inválidos sueltos -> null
    if (!normalized || normalized === "." || normalized === "-") {
      setText("");
      if (value !== null) onChange(null);
      return;
    }

    // Caso 2: Intentar convertir a número
    const num = Number(normalized);

    if (isNaN(num)) {
      // Si escribió basura ("1.2.3"), revertimos al valor real de Redux
      setText(value?.toString() ?? "");
    } else {
      // Si es válido, guardamos el número (1.50 -> 1.5)
      // Opcional: setText(String(num)) si quieres formatearlo inmediatamente al salir
      if (value !== num) onChange(num);
    }
  };

  return (
    <Input
      {...props}
      value={text}
      keyboardType="decimal-pad" // Teclado numérico con punto/coma
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      onChangeText={(t: string) => {
        // Permitimos escribir números, puntos, comas y signos negativos
        const sanitized = t.replace(/[^0-9.,-]/g, "");
        setText(sanitized);
      }}
      // DESCONECTAMOS el onCommitValue automático del Input original
      // porque ya estamos manejando el commit manualmente en onBlur
      onCommitValue={() => {}}
    />
  );
};

export default NumericInput;
