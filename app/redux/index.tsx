import { configureStore } from "@reduxjs/toolkit";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type TestResult = {
  name: string;
  ok: boolean;
  details?: string;
  metrics?: Record<string, number>;
  dur_ms?: number;
};

type StepStatus = "pending" | "running" | "ok" | "fail";

type Step = {
  id: string;
  label: string;
  run: (log: (r: TestResult) => void) => Promise<void>;
};

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, backgroundColor: "#0b0f14" },
  h1: { fontSize: 20, fontWeight: "700", color: "#e6edf3", marginBottom: 8 },
  p: { color: "#c9d1d9", marginBottom: 8, lineHeight: 20 },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#1f6feb",
  },
  btnGhost: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#30363d",
  },
  btnText: { color: "white", fontWeight: "600" },
  card: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#161b22",
    borderColor: "#30363d",
    borderWidth: 1,
  },
  ok: { color: "#3fb950", fontWeight: "700" },
  fail: { color: "#f85149", fontWeight: "700" },
  mono: { fontFamily: "monospace", color: "#c9d1d9" },
  step: { paddingVertical: 8, borderBottomColor: "#30363d", borderBottomWidth: 1 },
  progressWrap: {
    height: 10,
    width: "100%",
    backgroundColor: "#30363d",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 6,
  },
  progressBar: { height: "100%", backgroundColor: "#1f6feb" },
  modalContent: { flex: 1, backgroundColor: "#0b0f14", padding: 16 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "#30363d" },
  pillText: { color: "#c9d1d9", fontSize: 12 },
  input: {
    minWidth: 80,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#30363d",
    color: "#e6edf3",
    backgroundColor: "#161b22",
  },
});

/* ───────────────────── Helpers de introspección ───────────────────── */

const deepFreeze = (obj: any): any => {
  if (!obj || typeof obj !== "object") return obj;
  Object.freeze(obj);
  for (const k of Object.keys(obj)) {
    // @ts-expect-error index
    const v = obj[k];
    if (v && (typeof v === "object" || typeof v === "function") && !Object.isFrozen(v)) {
      deepFreeze(v);
    }
  }
  return obj;
};

const hasNonSerializable = (value: any): { path: string; type: string } | null => {
  const isPlain = (val: any) =>
    val === null ||
    typeof val === "string" ||
    typeof val === "number" ||
    typeof val === "boolean" ||
    Array.isArray(val) ||
    (typeof val === "object" && val.constructor === Object);

  const walk = (val: any, path: string[]): { path: string; type: string } | null => {
    const t = typeof val;
    if (
      t === "function" ||
      t === "symbol" ||
      t === "bigint" ||
      val instanceof Map ||
      val instanceof Set
    ) {
      return {
        path: path.join("."),
        type: t === "object" ? (val.constructor?.name ?? "object") : t,
      };
    }
    if (!isPlain(val)) {
      if (val && typeof val === "object") {
        // Permitimos Date/RegExp como “serializables por contrato de app” si vos así lo definís.
        if (val instanceof Date || val instanceof RegExp) return null;
        return { path: path.join("."), type: val.constructor?.name ?? "object" };
      }
    }
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        const r = walk(val[i], [...path, String(i)]);
        if (r) return r;
      }
      return null;
    }
    if (val && typeof val === "object") {
      for (const k of Object.keys(val)) {
        const r = walk(val[k], [...path, k]);
        if (r) return r;
      }
    }
    return null;
  };

  return walk(value, []);
};

const shallowEqual = (a: any, b: any) => {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (a[k] !== b[k]) return false;
  }
  return true;
};

const loadFormSessionReducer = (): any | null => {
  try {
    const mod = require("@/forms/state/formSessionSlice");
    // soporta export default o .reducer
    return mod?.default ?? mod?.reducer ?? null;
  } catch {
    return null;
  }
};

/* ─────────────────────────────  Pruebas  ───────────────────────────── */

const testReducerInit = async (log: (r: TestResult) => void, reducer: any) => {
  const t0 = performance.now();
  const init = reducer(undefined, { type: "@@INIT" });
  const ok = typeof init !== "undefined";
  let details = ok ? "Reducer devolvió un estado inicial definido." : "Reducer devolvió undefined.";
  let serialOk = true;
  try {
    JSON.stringify(init);
  } catch {
    serialOk = false;
  }
  if (!serialOk) details += " | JSON.stringify falló para el estado inicial.";
  log({
    name: "Estado inicial definido + serializable",
    ok: ok && serialOk,
    details,
    dur_ms: Math.round(performance.now() - t0),
  });
};

const testUnknownActionNoMutation = async (log: (r: TestResult) => void, reducer: any) => {
  const t0 = performance.now();
  const prev = reducer(undefined, { type: "@@INIT" });
  deepFreeze(prev);
  const next = reducer(prev, { type: "___UNKNOWN_ACTION___" });
  const ok = next === prev;
  log({
    name: "Acción desconocida no muta estado",
    ok,
    details: ok
      ? "next === prev (referencia idéntica)."
      : "El reducer devolvió un nuevo objeto ante acción desconocida (no es incorrecto, pero verifica performance).",
    dur_ms: Math.round(performance.now() - t0),
  });
};

const testDeterminism = async (log: (r: TestResult) => void, reducer: any) => {
  const t0 = performance.now();
  const prev = reducer(undefined, { type: "@@INIT" });
  const a1 = reducer(prev, { type: "___UNKNOWN_ACTION___" });
  const a2 = reducer(prev, { type: "___UNKNOWN_ACTION___" });
  const ok = a1 === a2 || JSON.stringify(a1) === JSON.stringify(a2);
  log({
    name: "Determinismo (misma entrada → misma salida)",
    ok,
    details: ok
      ? "Para la misma acción desconocida, el estado resultante fue idéntico."
      : "El resultado difirió.",
    dur_ms: Math.round(performance.now() - t0),
  });
};

const testSerializability = async (log: (r: TestResult) => void, reducer: any) => {
  const t0 = performance.now();
  const state = reducer(undefined, { type: "@@INIT" });
  const bad = hasNonSerializable(state);
  const jsonOk = (() => {
    try {
      JSON.stringify(state);
      return true;
    } catch {
      return false;
    }
  })();
  log({
    name: "Serializabilidad del estado",
    ok: !bad && jsonOk,
    details: bad
      ? `Se detectó valor no serializable en: ${bad.path} (tipo: ${bad.type}).`
      : "Sin valores no serializables detectados.",
    dur_ms: Math.round(performance.now() - t0),
  });
};

const testStoreIntegration = async (log: (r: TestResult) => void, reducer: any) => {
  const t0 = performance.now();
  const store = configureStore({ reducer });
  const prev = store.getState();
  store.dispatch({ type: "___UNKNOWN_ACTION___" });
  const next = store.getState();
  const ok = next === prev || shallowEqual(prev, next);
  log({
    name: "Integración con store (configureStore)",
    ok,
    details: ok
      ? "Estado estable ante acción desconocida (coincide con expectativas de reducers puros)."
      : "El estado cambió con acción desconocida.",
    dur_ms: Math.round(performance.now() - t0),
  });
};

const testPerformanceNoop = async (
  log: (r: TestResult) => void,
  reducer: any,
  iterations: number
) => {
  const t0 = performance.now();
  let state = reducer(undefined, { type: "@@INIT" });
  for (let i = 0; i < iterations; i++) {
    state = reducer(state, { type: "___UNKNOWN_ACTION___" });
  }
  const dur = performance.now() - t0;
  log({
    name: "Performance (acciones noop)",
    ok: true,
    details: `Se ejecutaron ${iterations} acciones desconocidas.`,
    metrics: { iterations, dur_ms: Math.round(dur), avg_us: Math.round((dur * 1000) / iterations) },
    dur_ms: Math.round(dur),
  });
};

/* ─────────────────────────────  Pantalla  ───────────────────────────── */

const ReduxDiagnosticsScreen: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [showJson, setShowJson] = useState(false);
  const [jsonStr, setJsonStr] = useState<string>("");
  const [iterations, setIterations] = useState<string>("10000");

  const reducer = useMemo(() => loadFormSessionReducer(), []);
  const reducerFound = !!reducer;

  const append = useCallback((r: TestResult) => setResults((old) => [...old, r]), []);

  const steps: Step[] = useMemo(() => {
    const arr: Step[] = [];
    if (!reducerFound) {
      // Paso “dummy” para explicar por qué se omiten las pruebas
      arr.push({
        id: "missing",
        label: "No se encontró reducer en @/forms/state/formSessionSlice",
        run: async (log) => {
          log({
            name: "Cargar reducer",
            ok: false,
            details:
              "No se pudo cargar el reducer. Verifica la ruta o export default en formSessionSlice.",
          });
        },
      });
      return arr;
    }
    arr.push(
      { id: "init", label: "Estado inicial definido", run: (l) => testReducerInit(l, reducer) },
      {
        id: "unknown",
        label: "Acción desconocida no muta",
        run: (l) => testUnknownActionNoMutation(l, reducer),
      },
      { id: "det", label: "Determinismo", run: (l) => testDeterminism(l, reducer) },
      {
        id: "serial",
        label: "Serializabilidad del estado",
        run: (l) => testSerializability(l, reducer),
      },
      { id: "store", label: "Integración con store", run: (l) => testStoreIntegration(l, reducer) },
      {
        id: "perf",
        label: "Performance (noop)",
        run: (l) =>
          testPerformanceNoop(l, reducer, Math.max(1, parseInt(iterations || "10000", 10))),
      }
    );
    return arr;
  }, [reducerFound, reducer, iterations]);

  const runAll = useCallback(async () => {
    if (running) return;
    setResults([]);
    setJsonStr("");
    setRunning(true);
    setStepStatuses(Object.fromEntries(steps.map((s) => [s.id, "pending" as StepStatus])));
    const runStep = async (s: Step) => {
      setStepStatuses((m) => ({ ...m, [s.id]: "running" }));
      const before = performance.now();
      try {
        await s.run((r) => append({ ...r }));
        setStepStatuses((m) => ({ ...m, [s.id]: "ok" }));
      } catch (e: any) {
        append({
          name: s.label,
          ok: false,
          details: `Excepción: ${String(e?.message ?? e)}`,
          dur_ms: Math.round(performance.now() - before),
        });
        setStepStatuses((m) => ({ ...m, [s.id]: "fail" }));
      }
    };
    try {
      for (const s of steps) {
        await runStep(s);
      }
    } finally {
      setRunning(false);
    }
  }, [append, running, steps]);

  const progress = useMemo(() => {
    const total = steps.length;
    const done = Object.values(stepStatuses).filter((x) => x === "ok" || x === "fail").length;
    const runningNow = Object.values(stepStatuses).includes("running") ? 0.25 : 0;
    const pct = total === 0 ? 0 : Math.min(1, (done + runningNow) / total);
    return { total, done, pct };
  }, [stepStatuses, steps.length]);

  const openExport = useCallback(async () => {
    const payload = {
      reducerFound,
      reducerModule: "@/forms/state/formSessionSlice",
      runAt: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      iterations: Math.max(1, parseInt(iterations || "10000", 10)),
      results,
      steps: steps.map((s) => ({ id: s.id, label: s.label, status: stepStatuses[s.id] })),
    };
    const json = JSON.stringify(payload, null, 2);
    setJsonStr(json);
    setShowJson(true);
  }, [reducerFound, iterations, results, stepStatuses, steps]);

  const shareJson = useCallback(async () => {
    try {
      await Share.share({ message: jsonStr });
    } catch (e) {
      console.log("[redux-diagnostic] JSON:", jsonStr, e);
      alert("No se pudo abrir el menú de compartir. Revisá consola.");
    }
  }, [jsonStr]);

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>Diagnóstico de Redux (FormSession)</Text>
      <Text style={styles.p}>
        Corre chequeos sobre el reducer (inicialización, identidad ante acción desconocida,
        determinismo, serializabilidad, integración con store y performance). Exporta los resultados
        como JSON usando
        <Text style={styles.mono}> Share </Text> (sin dependencias nativas).
      </Text>

      <View style={[styles.row, { flexWrap: "wrap", marginBottom: 8 }]}>
        <View style={[styles.row]}>
          <Text style={[styles.p, { marginRight: 6 }]}>Iteraciones (perf):</Text>
          <TextInput
            value={iterations}
            onChangeText={setIterations}
            keyboardType="numeric"
            style={styles.input}
            placeholder="10000"
            placeholderTextColor="#7d8590"
          />
        </View>
        <TouchableOpacity style={styles.btn} onPress={runAll} disabled={running}>
          <Text style={styles.btnText}>{running ? "Ejecutando…" : "Correr pruebas"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnGhost, { opacity: results.length ? 1 : 0.5 }]}
          onPress={openExport}
          disabled={!results.length || running}
        >
          <Text style={styles.btnText}>Exportar JSON</Text>
        </TouchableOpacity>
        {running ? <ActivityIndicator /> : null}
      </View>

      <View style={[styles.row, { justifyContent: "space-between", marginBottom: 6 }]}>
        <Text style={styles.p}>
          Pasos: {Object.values(stepStatuses).filter((x) => x === "ok" || x === "fail").length}/
          {steps.length}
        </Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>
            {Object.values(stepStatuses).includes("running") ? "En curso" : "Listo"}
          </Text>
        </View>
      </View>

      <View style={styles.progressWrap}>
        <View style={[styles.progressBar, { width: `${Math.round(progress.pct * 100)}%` }]} />
      </View>

      {/* Lista de pasos con estado */}
      <View style={[styles.card, { marginTop: 12 }]}>
        {steps.map((s) => {
          const st = stepStatuses[s.id] ?? "pending";
          const icon = st === "ok" ? "✔" : st === "fail" ? "✖" : st === "running" ? "⏳" : "•";
          const color =
            st === "ok" ? styles.ok.color : st === "fail" ? styles.fail.color : "#c9d1d9";
          return (
            <View key={s.id} style={styles.step}>
              <Text style={{ color }}>
                {icon} {s.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Resultados detallados */}
      <ScrollView>
        {results.map((r, i) => (
          <View key={i} style={styles.card}>
            <Text style={r.ok ? styles.ok : styles.fail}>
              {r.ok ? "✔" : "✖"} {r.name}
            </Text>
            {r.details ? <Text style={styles.p}>{r.details}</Text> : null}
            {r.metrics ? (
              <Text style={[styles.p, styles.mono]}>
                {Object.entries(r.metrics)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join("   ")}
              </Text>
            ) : null}
            {typeof r.dur_ms === "number" ? (
              <Text style={[styles.p, styles.mono]}>dur_ms: {r.dur_ms}</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>

      {/* Modal de exportación JSON */}
      <Modal visible={showJson} animationType="slide" onRequestClose={() => setShowJson(false)}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.h1}>Resultados (JSON)</Text>
            <View style={styles.row}>
              <Pressable style={[styles.btnGhost, { marginRight: 8 }]} onPress={shareJson}>
                <Text style={styles.btnText}>Compartir</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => setShowJson(false)}>
                <Text style={styles.btnText}>Cerrar</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView>
            <Text style={[styles.mono, { fontSize: 12 }]} selectable>
              {jsonStr}
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

export default ReduxDiagnosticsScreen;
