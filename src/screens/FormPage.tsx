import { Ionicons } from "@expo/vector-icons"; // Asegúrate de tener esto instalado: npx expo install @expo/vector-icons
import React, { useMemo, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";

// ⬇️ Componentes e Imports Locales
import { Body } from "@/components/atoms/Typography";
import FieldRenderer, { getFieldKind } from "./FieldRenderer";

// ⬇️ Redux
import { selectCurrentSessionId, setFieldValue } from "@/forms/state/formSessionSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

// ⬇️ Tipos (Mantenemos los que definiste)
export type Campo = {
  id_campo: string;
  sequence: number;
  tipo: "texto" | "booleano" | "numerico" | "imagen" | "group";
  clase: string;
  nombre_interno: string;
  etiqueta: string;
  ayuda?: string;
  config?: any;
  requerido: boolean;
};

export type Pagina = {
  id_pagina: string;
  secuencia: number;
  nombre: string;
  descripcion?: string;
  campos: Campo[];
};

export type Formulario = {
  id_formulario: string;
  nombre: string;
  paginas: Pagina[];
};

type Frame = { width: number; height: number };

type Props = {
  page: Pagina;
  formName?: string;
  referenceFrame: Frame;
  contentFrame: Frame;
  mode?: "edit" | "review" | "view";
};

// ⬇️ Habilitar LayoutAnimation para Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const FormPageView: React.FC<Props> = ({ page, formName, referenceFrame, contentFrame, mode }) => {
  const dispatch = useAppDispatch();
  const sessionId = useAppSelector(selectCurrentSessionId);

  // Estado para controlar columnas (true = Grid/2 columnas, false = Lista/1 columna)
  const [isGridMode, setIsGridMode] = useState(true);

  const fields = useMemo(
    () => [...(page?.campos || [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)),
    [page?.campos]
  );

  const minSide = Math.min(referenceFrame.width, referenceFrame.height);
  const padBottom = clamp(minSide * 0.02, 12, 24);
  const headerGap = clamp(minSide * 0.012, 8, 16);
  const fieldGap = clamp(minSide * 0.016, 10, 22);

  // Función para alternar el layout con animación
  const toggleLayout = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsGridMode(!isGridMode);
  };

  return (
    <View style={{ paddingRight: 0, paddingBottom: padBottom * 1.1 }}>
      {/* ⬇️ HEADER + BOTÓN DE VISTA */}
      <View style={styles.headerContainer}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Body weight="bold" size="xl">
            {page?.nombre}
          </Body>
          {page?.descripcion ? (
            <Body frame={referenceFrame} color="secondary" size="sm" style={{ marginTop: 4 }}>
              {page.descripcion}
            </Body>
          ) : null}
        </View>

        {/* Botón estético para cambiar vista */}
        <TouchableOpacity onPress={toggleLayout} activeOpacity={0.7} style={styles.toggleButton}>
          <Ionicons name={isGridMode ? "grid-outline" : "list-outline"} size={20} color="#555" />
        </TouchableOpacity>
      </View>

      <View style={{ height: headerGap }} />

      {/* ⬇️ CONTENEDOR DE CAMPOS */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        {fields.map((f) => {
          const kind = getFieldKind(f);

          // Campos que SIEMPRE deben ocupar todo el ancho por su naturaleza
          const isNaturallyFullWidth = kind === "group" || kind === "firm";

          // Lógica de ancho:
          // 1. Si el modo Grid está apagado -> 100%
          // 2. Si el campo es grande por naturaleza -> 100%
          // 3. Si no, respetamos el grid de 2 columnas -> 48%
          const width = !isGridMode || isNaturallyFullWidth ? "100%" : "48%";

          return (
            <View
              key={f.id_campo}
              style={{
                width,
                marginBottom: fieldGap,
              }}
            >
              <FieldRenderer
                campo={f}
                formName={formName}
                referenceFrame={referenceFrame}
                contentFrame={contentFrame}
                onChangeValue={(name, value) =>
                  sessionId && dispatch(setFieldValue({ sessionId, nombreInterno: name, value }))
                }
                mode={mode}
              />
            </View>
          );
        })}
      </View>

      <View style={{ height: padBottom * 0 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  toggleButton: {
    backgroundColor: "#F2F4F7", // Gris suave y limpio
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    // Sombra muy sutil para darle profundidad
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
});

export default FormPageView;
