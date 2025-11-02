import { router } from "expo-router";
import * as SQLite from "expo-sqlite";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
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

const DB_NAME = "forms.db";
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
  modalContent: {
    flex: 1,
    backgroundColor: "#0b0f14",
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#30363d",
  },
  pillText: { color: "#c9d1d9", fontSize: 12 },
});

const withDb = async <T,>(
  fn: (db: SQLite.SQLiteDatabase) => Promise<T>,
  opts?: SQLite.SQLiteOpenOptions
): Promise<T> => {
  const db = await SQLite.openDatabaseAsync(DB_NAME, { useNewConnection: true, ...opts });
  try {
    await db.execAsync("PRAGMA foreign_keys = ON;");
    await db.execAsync("PRAGMA journal_mode = WAL;"); // WAL para pruebas de concurrencia
    return await fn(db);
  } finally {
    await db.closeAsync();
  }
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ─────────────────────────────  Pruebas  ───────────────────────────── */

const prepareSchema = async (log: (r: TestResult) => void) => {
  const t0 = performance.now();
  await withDb(async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS diag_bench (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        val INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS diag_meta (
        k TEXT PRIMARY KEY,
        v TEXT
      );
      DELETE FROM diag_bench;
      DELETE FROM diag_meta;
    `);
  });
  log({
    name: "Preparación de esquema",
    ok: true,
    details: "Tablas diag_* listas y vacías.",
    dur_ms: Math.round(performance.now() - t0),
  });
};

const testAtomicity = async (log: (r: TestResult) => void) => {
  const N = 1000;
  const t0 = performance.now();
  let ok = false;
  let details = "";
  await withDb(async (db) => {
    await db.execAsync("DELETE FROM diag_bench;");
    await db.execAsync("BEGIN;");
    try {
      for (let i = 0; i < N; i++) {
        if (i === Math.floor(N / 2)) {
          throw new Error("Fallo controlado a mitad de la transacción");
        }
        await db.runAsync("INSERT INTO diag_bench(val) VALUES (?);", [i]);
      }
      await db.execAsync("COMMIT;");
    } catch {
      await db.execAsync("ROLLBACK;");
    }
    const { count } = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM diag_bench;"
    );
    ok = count === 0;
    details = `Después del fallo forzado, conteo = ${count} (esperado 0 si la transacción es atómica).`;
  });
  log({
    name: "Atomicidad de transacciones (rollback íntegro)",
    ok,
    details,
    dur_ms: Math.round(performance.now() - t0),
  });
};

const testBatchPerf = async (log: (r: TestResult) => void) => {
  const N = 3000;

  const insertNoTxn = async () =>
    withDb(async (db) => {
      await db.execAsync("DELETE FROM diag_bench;");
      const t0 = performance.now();
      for (let i = 0; i < N; i++) {
        await db.runAsync("INSERT INTO diag_bench(val) VALUES (?);", [i]);
      }
      const t1 = performance.now();
      const { count } = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM diag_bench;"
      );
      return { ms: t1 - t0, count };
    });

  const insertWithTxn = async () =>
    withDb(async (db) => {
      await db.execAsync("DELETE FROM diag_bench;");
      const t0 = performance.now();
      await db.execAsync("BEGIN;");
      try {
        for (let i = 0; i < N; i++) {
          await db.runAsync("INSERT INTO diag_bench(val) VALUES (?);", [i]);
        }
        await db.execAsync("COMMIT;");
      } catch (e) {
        await db.execAsync("ROLLBACK;");
        throw e;
      }
      const t1 = performance.now();
      const { count } = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM diag_bench;"
      );
      return { ms: t1 - t0, count };
    });

  const a = await insertNoTxn();
  const b = await insertWithTxn();

  log({
    name: "Rendimiento batch (sin vs con transacción)",
    ok: b.count === N && a.count === N && b.ms < a.ms,
    details: `Inserciones N=${N}. Con transacción suele ser más veloz por reducción de I/O/fsync.`,
    metrics: { sin_txn_ms: Math.round(a.ms), con_txn_ms: Math.round(b.ms) },
    dur_ms: Math.round(a.ms + b.ms),
  });
};

const testWalConcurrency = async (log: (r: TestResult) => void) => {
  const WRITES = 1200;
  const t0 = performance.now();
  let busy = 0;
  let reads = 0;

  const writer = SQLite.openDatabaseAsync(DB_NAME, { useNewConnection: true });
  const reader = SQLite.openDatabaseAsync(DB_NAME, { useNewConnection: true });

  try {
    const [dbW, dbR] = await Promise.all([writer, reader]);
    await dbW.execAsync("PRAGMA foreign_keys = ON; PRAGMA journal_mode=WAL;");
    await dbR.execAsync("PRAGMA foreign_keys = ON; PRAGMA journal_mode=WAL;");
    await dbW.execAsync("DELETE FROM diag_bench;");

    let stop = false;
    const readLoop = (async () => {
      while (!stop) {
        try {
          await dbR.getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM diag_bench;");
          reads++;
        } catch (e: any) {
          const msg = String(e?.message ?? e);
          if (msg.includes("SQLITE_BUSY")) busy++;
        }
        await sleep(0);
        if (reads >= WRITES * 2) break;
      }
    })();

    await dbW.execAsync("BEGIN;");
    for (let i = 0; i < WRITES; i++) {
      await dbW.runAsync("INSERT INTO diag_bench(val) VALUES (?);", [i]);
      if (i % 200 === 0) await sleep(0);
    }
    await dbW.execAsync("COMMIT;");

    stop = true;
    await readLoop;

    const { count } = await dbW.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM diag_bench;"
    );

    log({
      name: "Concurrencia WAL (lectores vs escritor)",
      ok: count === WRITES,
      details:
        "En WAL, lectores normalmente no bloquean escritores; contabilizamos SQLITE_BUSY si aparece.",
      metrics: {
        writes: WRITES,
        rows: count,
        reads,
        SQLITE_BUSY: busy,
        dur_ms: Math.round(performance.now() - t0),
      },
      dur_ms: Math.round(performance.now() - t0),
    });
  } finally {
    try {
      const dbW = await writer;
      await dbW.closeAsync();
    } catch {}
    try {
      const dbR = await reader;
      await dbR.closeAsync();
    } catch {}
  }
};

const cleanupAll = async (log: (r: TestResult) => void) => {
  const t0 = performance.now();
  await withDb(async (db) => {
    await db.execAsync(`
      DELETE FROM diag_bench;
      DELETE FROM diag_meta;
      PRAGMA wal_checkpoint(TRUNCATE);
    `);
  });
  log({
    name: "Limpieza",
    ok: true,
    details: "Se vaciaron diag_* y se hizo checkpoint TRUNCATE del WAL.",
    dur_ms: Math.round(performance.now() - t0),
  });
};

/* ─────────────────────────────  Pantalla  ───────────────────────────── */

const SQLiteDiagnosticsScreen: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [showJson, setShowJson] = useState(false);
  const [jsonStr, setJsonStr] = useState<string>("");

  const steps: Step[] = useMemo(
    () => [
      { id: "prepare", label: "Preparación de esquema", run: prepareSchema },
      { id: "atomicity", label: "Atomicidad de transacciones", run: testAtomicity },
      { id: "batch", label: "Rendimiento por lotes", run: testBatchPerf },
      { id: "wal", label: "Concurrencia WAL", run: testWalConcurrency },
      { id: "cleanup", label: "Limpieza final", run: cleanupAll },
    ],
    []
  );

  const append = useCallback((r: TestResult) => {
    setResults((old) => [...old, r]);
  }, []);

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
        await s.run((r) => append({ ...r })); // log interno por prueba
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
        // Garantizamos que 'cleanup' corra incluso si algo falla
        if (s.id !== "cleanup") {
          try {
            await runStep(s);
          } catch {}
        }
      }
    } finally {
      // cleanup siempre al final como paso visible
      const s = steps.find((x) => x.id === "cleanup")!;
      await runStep(s);
      setRunning(false);
    }
  }, [append, running, steps]);

  const progress = useMemo(() => {
    const total = steps.length;
    const done = Object.values(stepStatuses).filter((x) => x === "ok" || x === "fail").length;
    const runningNow = Object.values(stepStatuses).includes("running") ? 0.25 : 0; // un poco de fill al estar ejecutando
    const pct = total === 0 ? 0 : Math.min(1, (done + runningNow) / total);
    return { total, done, pct };
  }, [stepStatuses, steps.length]);

  const openExport = useCallback(async () => {
    const payload = {
      db: DB_NAME,
      runAt: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      results,
      steps: steps.map((s) => ({ id: s.id, label: s.label, status: stepStatuses[s.id] })),
    };
    const json = JSON.stringify(payload, null, 2);
    setJsonStr(json);

    // Guardar en diag_meta para persistencia local
    try {
      await withDb(async (db) => {
        await db.runAsync("INSERT OR REPLACE INTO diag_meta(k, v) VALUES (?, ?);", [
          "last_results",
          json,
        ]);
      });
    } catch {}
    setShowJson(true);
  }, [results, stepStatuses, steps]);

  const shareJson = useCallback(async () => {
    try {
      await Share.share({ message: jsonStr });
    } catch (e) {
      console.log("[diagnóstico] JSON:", jsonStr, e);
      alert("No se pudo abrir el menú de compartir. Revisá consola.");
    }
  }, [jsonStr]);

  const cleanupOnly = useCallback(async () => {
    if (running) return;
    setResults([]);
    setStepStatuses({});
    setJsonStr("");
    setRunning(true);
    try {
      await cleanupAll(append);
      setStepStatuses({ cleanup: "ok" });
    } catch (e: any) {
      setStepStatuses({ cleanup: "fail" });
      append({ name: "Limpieza", ok: false, details: String(e?.message ?? e) });
    } finally {
      setRunning(false);
    }
  }, [append, running]);

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>Diagnóstico local de SQLite</Text>
      <Text style={styles.p}>
        Pruebas internas sobre la DB ({DB_NAME}): atomicidad, rendimiento con/sin transacción y
        concurrencia en WAL. Al final limpia todo lo temporal{" "}
        <Text style={styles.mono}>diag_*</Text>.
      </Text>

      <View style={[styles.row, { marginBottom: 8 }]}>
        <TouchableOpacity style={styles.btn} onPress={runAll} disabled={running}>
          <Text style={styles.btnText}>{running ? "Ejecutando…" : "Correr pruebas"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnGhost} onPress={cleanupOnly} disabled={running}>
          <Text style={styles.btnText}>Limpiar</Text>
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
      {
        // Boton para ir a los test de redux
      }
      <TouchableOpacity
        style={[styles.btnGhost, { marginBottom: 12 }]}
        onPress={() => {
          router.replace("/redux");
        }}
        disabled={running}
      >
        <Text style={styles.btnText}>Ir a los test de Redux</Text>
      </TouchableOpacity>

      <View style={[styles.row, { justifyContent: "space-between", marginBottom: 6 }]}>
        <Text style={styles.p}>
          Pasos: {progress.done}/{progress.total}
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

      {/* Lista de pasos con estado en vivo */}
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

export default SQLiteDiagnosticsScreen;
