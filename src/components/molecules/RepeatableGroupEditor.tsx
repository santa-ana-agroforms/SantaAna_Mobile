// src/components/molecules/RepeatableGroupEditor.tsx
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { CampoLite, GroupRow } from "./RepeatableGroup";

type Props = {
  fieldsTemplate: CampoLite[];
  value: GroupRow;
  onChange: (next: GroupRow) => void;
  onSave: () => void;
  onCancel: () => void;
  isNew?: boolean;
};

/**
 * Editor simple: genera inputs de texto para cada campo del template.
 * Si necesitás tipos/formatos específicos por "tipo" o "clase",
 * podés extender el switch aquí.
 */
const RepeatableGroupEditor: React.FC<Props> = ({
  fieldsTemplate,
  value,
  onChange,
  onSave,
  onCancel,
  isNew = false,
}) => {
  const updateField = (name: string, nextVal: any) => {
    onChange({ ...value, [name]: nextVal });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={styles.wrap}
    >
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text allowFontScaling={false} style={styles.modeTitle}>
          {isNew ? "Nueva entrada" : "Editando entrada"}
        </Text>

        {fieldsTemplate.map((c) => {
          const label = c.etiqueta ?? c.nombre_interno;
          const val = value[c.nombre_interno] ?? "";
          const required = !!c.requerido;

          // Simple: tratamos todo como texto; ajustá según c.tipo si querés
          return (
            <View key={c.id_campo} style={styles.fieldRow}>
              <Text allowFontScaling={false} style={styles.label}>
                {label}
                {required ? (
                  <Text allowFontScaling={false} style={styles.req}>
                    *
                  </Text>
                ) : null}
              </Text>
              <TextInput
                allowFontScaling={false}
                style={styles.input}
                value={String(val)}
                onChangeText={(t) => updateField(c.nombre_interno, t)}
                placeholder={label}
                placeholderTextColor="#999"
              />
            </View>
          );
        })}

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.cancel]} onPress={onCancel}>
            <Text allowFontScaling={false} style={styles.btnText}>
              ↩ Cancelar
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.save]} onPress={onSave}>
            <Text allowFontScaling={false} style={[styles.btnText, styles.saveText]}>
              ✔ Guardar
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default RepeatableGroupEditor;

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  form: {
    gap: 12,
    paddingBottom: 12,
  },
  modeTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  fieldRow: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
  },
  req: { color: "#D00" },
  input: {
    borderWidth: 1,
    borderColor: "#E2E2E2",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "white",
  },
  actions: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancel: {
    backgroundColor: "#F2F2F2",
  },
  save: {
    backgroundColor: "#0A84FF",
  },
  btnText: {
    fontWeight: "700",
  },
  saveText: {
    color: "white",
  },
});
