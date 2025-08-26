import { Body, Title } from "@/components/atoms/Typography";
import PageScaffold from "@/components/templates/PageScaffold";
import { DB } from "@/db/sqlite";
import { useResponsive } from "@/hooks/useResponsive";
import { colors } from "@/theme/tokens";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

// Tipos mínimos con lo que ya tienes
type VersionVigente = {
  id_index_version: string;
  fecha_creacion: string; // ISO
};

type Formulario = {
  id_formulario: string;
  nombre: string;
  version_vigente: VersionVigente;
};

// "@/api/forms/types"
export type FormCategoryGroup = {
  nombre_categoria: string;
  descripcion: string | null; // 👈 antes era string | undefined
  formularios: {
    id_formulario: string;
    nombre: string;
    version_vigente: {
      id_index_version: string;
      fecha_creacion: string;
    };
  }[];
};

const ENTER_BTN_SIZE = 36;

export default function FormsByCategoryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const { gutter, rem } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [grupo, setGrupo] = useState<FormCategoryGroup | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const groups: FormCategoryGroup[] = await DB.selectFormsGroupedByCategory();
        const found = groups.find(g => g.nombre_categoria === category);
        setGrupo(found ?? null);
        setLastSync(new Date()); // placeholder; cámbialo por tu valor real
      } finally {
        setLoading(false);
      }
    })();
  }, [category]);

  const headerTitle = useMemo(() => grupo?.nombre_categoria ?? "Formularios", [grupo]);

  if (loading) {
    return (
      <PageScaffold title={String(category)} variant="categories">
        <Body>Cargando…</Body>
      </PageScaffold>
    );
  }

  if (!grupo) {
    return (
      <PageScaffold title="Formularios" variant="categories">
        <Body>No se encontró la categoría: {String(category)}</Body>
      </PageScaffold>
    );
  }

  return (
    <PageScaffold title={headerTitle} variant="groups">
      {/* Lista de formularios */}
      <View style={{ gap: gutter }}>
        {grupo.formularios.map((f) => {
          const estado = getEstado(f); // placeholder
          const asignado = f.version_vigente?.fecha_creacion
            ? new Date(f.version_vigente.fecha_creacion)
            : null;
          const disponibleHasta = getFechaDisponibleHasta(asignado); // +30 días (placeholder)

          return (
            <Pressable
            key={f.id_formulario}
            onPress={() => {/* ... */}}
            style={[
                styles.card,
                {
                padding: gutter,
                borderRadius: 12,
                // 👇 reserva espacio a la derecha del contenido = tamaño del botón + margen
                paddingRight: gutter + ENTER_BTN_SIZE + gutter / 2,
                minHeight: 88, // opcional, para que el botón tenga aire y se centre bonito
                },
            ]}
            >
            {/* Título */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Image
                source={require("../../assets/images/form.png")}
                style={{ width: 22, height: 22, marginTop: 2 }}
                resizeMode="contain"
                />
                <Title style={{ fontSize: rem * 1.4, color: "#5B4B24", flexShrink: 1 }}>
                {f.nombre}
                </Title>
            </View>

            {/* Fila: estado + asignado (a la izquierda del botón) */}
            <View
                style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 2,
                }}
            >
                <Body>
                <Body style={{ fontWeight: "700" }}>{estado.texto}</Body>{" "}
                <StatusDot color={estado.color} />
                </Body>

                {asignado && (
                <Body>Asignado el {formatFechaCorta(asignado)}</Body>
                )}
            </View>

            {/* Disponible hasta */}
            {disponibleHasta && (
                <Body color="secondary">
                Disponible hasta el {formatFechaCorta(disponibleHasta)} 🕒
                </Body>
            )}

            {/* Botón de acceso (absoluto y centrado) */}
            <View
                style={{
                position: "absolute",
                right: gutter,
                top: "50%",
                marginTop: -(ENTER_BTN_SIZE / 8), // centra verticalmente
                width: ENTER_BTN_SIZE,
                height: ENTER_BTN_SIZE,
                borderRadius: 10,
                backgroundColor: colors.primary600,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 2,
                }}
                pointerEvents="none"
            >
                <Image
                source={require("../../assets/images/enter.png")}
                style={{ width: 22, height: 22 }}
                resizeMode="contain"
                />
            </View>
            </Pressable>
          );
        })}
      </View>
    </PageScaffold>
  );
}

/* ------------ helpers de UI ------------ */
function StatusDot({ color = "#888" }: { color?: string }) {
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        backgroundColor: color,
        marginLeft: 6,
        marginBottom: 1,
      }}
    />
  );
}

/* ------------ lógica placeholder (ajusta cuando tengas datos reales) ------------ */
function getEstado(f: Formulario): { texto: "Pendiente" | "En progreso" | "Completado"; color: string } {
  // Sin campo real, decidimos por fecha: recién creado -> Pendiente; >7 días -> En progreso; >20 días -> Completado
  const created = f.version_vigente?.fecha_creacion ? new Date(f.version_vigente.fecha_creacion) : null;
  if (!created) return { texto: "Pendiente", color: "#9CA3AF" };

  const diff = Date.now() - created.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days > 20) return { texto: "Completado", color: "#2E7D32" };
  if (days > 7) return { texto: "En progreso", color: "#8B4513" };
  return { texto: "Pendiente", color: "#9CA3AF" };
}

function getFechaDisponibleHasta(asignado: Date | null): Date | null {
  if (!asignado) return null;
  const d = new Date(asignado);
  d.setDate(d.getDate() + 30); // placeholder: +30 días
  return d;
}

/* ------------ format helpers ------------ */
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function formatHoraMin(d: Date | null) {
  if (!d) return "--:--";
  const h = d.getHours();
  const m = d.getMinutes();
  return `${pad(h)}:${pad(m)}`;
}

function formatFechaCorta(d: Date) {
  // dd/MM
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/* ------------ estilos ------------ */
const styles = StyleSheet.create({
  header: {
    position: "relative",
    borderBottomColor: "#DDD0B6",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#E7F2E6",
    alignSelf: "flex-end",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
});
