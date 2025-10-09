// src/components/molecules/RepeatableGroup.tsx
import React, { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import RepeatableGroupEditor from "./RepeatableGroupEditor";
import RepeatableGroupItem from "./RepeatableGroupItem";

/** ===== Tipos del dominio (compat con tu base) ===== */
export type CampoLite = {
  id_campo: string;
  nombre_interno: string;
  etiqueta?: string;
  requerido?: boolean;
  sequence?: number;
  tipo?: string;
  clase?: string;
};

export type GroupRow = Record<string, any> & { __id: string };

type Frame = { width: number; height: number };

type Props = {
  title?: string;
  fieldsTemplate: CampoLite[];
  /** Filas ya persistidas (planas con __id) */
  entries: GroupRow[];
  onChange: (next: GroupRow[]) => void;

  /** Si el grupo es obligatorio (exigir al menos 1 entrada) */
  required?: boolean;
  /** Mínimo de entradas (default 1 si required=true; 0 en caso contrario) */
  minEntries?: number;

  /** Render propio de “resumen” (mini vista). Si no se da, se usa uno por defecto. */
  renderSummary?: (row: GroupRow, idx: number) => React.ReactNode;
  /** Tamaño útil (opcional, por si ajustás layout externamente) */
  referenceFrame?: Frame;
};

/** ====== Utils ====== */
const genId = () => `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const makeEmptyRowFromTemplate = (tpl: CampoLite[]): GroupRow => {
  const base: GroupRow = { __id: genId() };
  for (const c of tpl) {
    // Por defecto string vacío; si necesitás defaults por tipo, los podés mapear aquí
    base[c.nombre_interno] = "";
  }
  return base;
};

/** ====== Componente principal ====== */
const RepeatableGroup: React.FC<Props> = ({
  title,
  fieldsTemplate,
  entries,
  onChange,
  required = false,
  minEntries,
  renderSummary,
}) => {
  const _minEntries = useMemo(
    () => (required ? (minEntries ?? 1) : (minEntries ?? 0)),
    [required, minEntries]
  );

  /** id que está en edición (si existe). Cuando hay valor, se oculta la “mini vista” y el botón Agregar. */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** copia “draft” que edita el usuario antes de Guardar */
  const [draft, setDraft] = useState<GroupRow | null>(null);
  /** bandera: si el draft es NUEVO (no existía antes) */
  const [isNewDraft, setIsNewDraft] = useState<boolean>(false);

  const hasAny = entries.length > 0;

  /** Pasar a modo edición desde una entrada existente */
  const onEdit = useCallback(
    (rowId: string) => {
      const found = entries.find((r) => r.__id === rowId);
      if (!found) return;
      setDraft({ ...found });
      setIsNewDraft(false);
      setEditingId(rowId);
    },
    [entries]
  );

  /** Crear una nueva entrada y abrirla en edición (oculta las demás) */
  const onAddNew = useCallback(() => {
    if (editingId) return; // ya hay algo en edición
    const emptyRow = makeEmptyRowFromTemplate(fieldsTemplate);
    setDraft(emptyRow);
    setIsNewDraft(true);
    setEditingId(emptyRow.__id);
  }, [editingId, fieldsTemplate]);

  /** Guardar (✔) – reemplaza si existía, o agrega al final si es nuevo */
  const onSave = useCallback(() => {
    if (!draft || !editingId) return;

    // Validación mínima: si algún campo del template requerido está vacío
    const missingRequired = fieldsTemplate.some(
      (c) => c.requerido && (draft[c.nombre_interno] === "" || draft[c.nombre_interno] == null)
    );
    if (missingRequired) {
      Alert.alert("Campos obligatorios", "Completá los campos requeridos antes de guardar.");
      return;
    }

    const idx = entries.findIndex((r) => r.__id === editingId);
    let next: GroupRow[];
    if (idx >= 0) {
      next = [...entries];
      next[idx] = { ...draft };
    } else {
      next = [...entries, { ...draft }];
    }
    onChange(next);
    // salir de edición
    setEditingId(null);
    setDraft(null);
    setIsNewDraft(false);
  }, [draft, editingId, entries, onChange, fieldsTemplate]);

  /** Cancelar (↩) – si es la primera y es requerido, no dejar cancelar */
  const onCancel = useCallback(() => {
    if (!draft) {
      setEditingId(null);
      setIsNewDraft(false);
      return;
    }
    const isFirstEver = entries.length === 0 && isNewDraft;
    if (required && isFirstEver) {
      Alert.alert(
        "Este grupo es obligatorio",
        "Necesitás guardar al menos una entrada. Completá y guardá, porfa."
      );
      return;
    }
    // descartar draft y salir
    setEditingId(null);
    setDraft(null);
    setIsNewDraft(false);
  }, [draft, entries.length, isNewDraft, required]);

  /** Eliminar */
  const onDelete = useCallback(
    (rowId: string) => {
      if (required && entries.length <= _minEntries) {
        Alert.alert(
          "No se puede eliminar",
          `Se requiere al menos ${_minEntries} entr${_minEntries === 1 ? "ada" : "adas"}.`
        );
        return;
      }
      const next = entries.filter((r) => r.__id !== rowId);
      onChange(next);
    },
    [entries, onChange, required, _minEntries]
  );

  /** Reordenar (simple: subir/bajar) */
  const moveItem = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= entries.length) return;
      const next = [...entries];
      const [picked] = next.splice(from, 1);
      next.splice(to, 0, picked);
      onChange(next);
    },
    [entries, onChange]
  );

  /** ====== Render ====== */

  // Modo edición: ocultar TODO salvo el editor
  if (editingId && draft) {
    return (
      <View style={styles.container}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <RepeatableGroupEditor
          fieldsTemplate={fieldsTemplate}
          value={draft}
          onChange={setDraft}
          onSave={onSave}
          onCancel={onCancel}
          isNew={isNewDraft}
        />
      </View>
    );
  }

  // Modo lista (mini vista)
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <TouchableOpacity style={styles.addBtn} onPress={onAddNew}>
          <Text style={styles.addBtnText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      {!hasAny ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            {required ? "Agregá al menos una entrada." : "Sin entradas aún."}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
          {entries.map((row, idx) => (
            <RepeatableGroupItem
              key={row.__id}
              row={row}
              index={idx}
              fieldsTemplate={fieldsTemplate}
              onEdit={() => onEdit(row.__id)}
              onDelete={() => onDelete(row.__id)}
              onMoveUp={() => moveItem(idx, idx - 1)}
              onMoveDown={() => moveItem(idx, idx + 1)}
              renderSummary={renderSummary}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

export default RepeatableGroup;

/** ====== estilos mínimos ====== */
const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: "#E6E6E6",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    backgroundColor: "white",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#0A84FF",
  },
  addBtnText: {
    color: "white",
    fontWeight: "700",
  },
  list: {
    width: "100%",
  },
  emptyBox: {
    borderWidth: 1,
    borderColor: "#E6E6E6",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#FBFBFB",
  },
  emptyText: {
    color: "#555",
  },
});
