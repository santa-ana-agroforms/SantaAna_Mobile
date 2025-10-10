// src/components/molecules/RepeatableGroupItem.tsx
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { CampoLite, GroupRow } from "./RepeatableGroup";

type Props = {
  row: GroupRow;
  index: number;
  fieldsTemplate: CampoLite[];
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  renderSummary?: (row: GroupRow, idx: number) => React.ReactNode;
};

const RepeatableGroupItem: React.FC<Props> = ({
  row,
  index,
  fieldsTemplate,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  renderSummary,
}) => {
  return (
    <View style={styles.card}>
      <TouchableOpacity style={{ flex: 1 }} onPress={onEdit} activeOpacity={0.75}>
        {renderSummary ? (
          renderSummary(row, index)
        ) : (
          <DefaultSummary row={row} fieldsTemplate={fieldsTemplate} index={index} />
        )}
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity onPress={onMoveUp} style={[styles.smallBtn, styles.ghost]}>
          <Text allowFontScaling={false} style={styles.smallBtnText}>
            ↑
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onMoveDown} style={[styles.smallBtn, styles.ghost]}>
          <Text allowFontScaling={false} style={styles.smallBtnText}>
            ↓
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onEdit} style={[styles.smallBtn, styles.edit]}>
          <Text allowFontScaling={false} style={[styles.smallBtnText, styles.white]}>
            Editar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={[styles.smallBtn, styles.danger]}>
          <Text allowFontScaling={false} style={[styles.smallBtnText, styles.white]}>
            Eliminar
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default RepeatableGroupItem;

const DefaultSummary: React.FC<{ row: GroupRow; fieldsTemplate: CampoLite[]; index: number }> = ({
  row,
  fieldsTemplate,
  index,
}) => {
  // primeras 2-3 claves como “preview”
  const keys = fieldsTemplate.slice(0, 3).map((c) => c.nombre_interno);
  return (
    <View style={{ gap: 4 }}>
      <Text allowFontScaling={false} style={styles.cardTitle}>
        Entrada #{index + 1}
      </Text>
      <View style={{ gap: 2 }}>
        {keys.map((k) => (
          <Text allowFontScaling={false} key={k} style={styles.cardLine}>
            <Text allowFontScaling={false} style={styles.key}>
              {k}:
            </Text>
            <Text allowFontScaling={false} style={styles.val}>
              {String(row[k] ?? "")}
            </Text>
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E6E6E6",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#FAFAFA",
  },
  cardTitle: {
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 2,
  },
  cardLine: {
    fontSize: 13,
    color: "#333",
  },
  key: { fontWeight: "600", color: "#555" },
  val: { color: "#222" },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  smallBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  smallBtnText: { fontWeight: "700" },
  ghost: {
    backgroundColor: "white",
    borderColor: "#E2E2E2",
  },
  edit: {
    backgroundColor: "#0A84FF",
    borderColor: "#0A84FF",
  },
  danger: {
    backgroundColor: "#E53935",
    borderColor: "#E53935",
  },
  white: { color: "white" },
});
