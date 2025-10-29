// src/background/midnight-cleanup.ts
import { clearTokens } from "@/api/client";
import { clearDatasets, clearFormsAndCategories, clearGroups, getDb } from "@/db/sqlite";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

// Utilidad: fecha local YYYY-MM-DD (sin husos)
const ymdLocal = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const MIDNIGHT_CLEAN_TASK = "midnight-clean-task";

// La tarea corre cuando el SO la dispare (cada X minutos). Si cambió la fecha local → limpia.
const runMidnightCleanup = async (): Promise<BackgroundTask.BackgroundTaskResult> => {
  try {
    const db = await getDb();

    // Lee última fecha de limpieza
    const [row] = await db.getAllAsync<{ v: string }>(`SELECT v FROM kv WHERE k = ? LIMIT 1`, [
      "daily.cleanup.lastYmd",
    ]);
    const lastYmd = row?.v ?? null;
    const todayYmd = ymdLocal(new Date());

    if (lastYmd === todayYmd) {
      // Ya limpiamos hoy → no hacer nada
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    // *** Ejecutar la limpieza ***
    await db.withTransactionAsync(async () => {
      // Borra tus datos locales (usa tus helpers existentes)
      await clearDatasets();
      await clearGroups();
      await clearFormsAndCategories();

      // Borra entradas offline llenadas (si aplica)
      await db.execAsync(`DELETE FROM form_entries;`);
      await db.execAsync(`DELETE FROM form_usage;`);

      // (Opcional) limpiar claves de dedupe de notificaciones del día anterior
      // await db.execAsync(`DELETE FROM kv WHERE k LIKE 'noti.%';`);
    });

    // Cerrar sesión / limpiar tokens seguros
    await clearTokens();

    // Marca del día
    await db.runAsync(`INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)`, [
      "daily.cleanup.lastYmd",
      todayYmd,
    ]);

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    console.error("Midnight cleanup failed:", e);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
};

TaskManager.defineTask(MIDNIGHT_CLEAN_TASK, async () => {
  return await runMidnightCleanup();
});

// Registrar la tarea con un intervalo mínimo (no exacto)
export const registerMidnightCleanup = async () => {
  // Intervalo mínimo. El SO decide el momento real; 30–60 min es buen balance.
  await BackgroundTask.registerTaskAsync(MIDNIGHT_CLEAN_TASK, {
    // en minutos (mínimo real 15 en Android; iOS lo trata como referencia)
    minimumInterval: 60,
  });
};

export const unregisterMidnightCleanup = async () => {
  await BackgroundTask.unregisterTaskAsync(MIDNIGHT_CLEAN_TASK);
};

// Fallback: por si el SO no corrió la tarea, valida al abrir la app.
export const ensureDailyCleanupNowIfNeeded = async () => {
  const db = await getDb();
  const todayYmd = ymdLocal(new Date());
  const [row] = await db.getAllAsync<{ v: string }>(`SELECT v FROM kv WHERE k = ? LIMIT 1`, [
    "daily.cleanup.lastYmd",
  ]);
  if (row?.v === todayYmd) return;

  // Re-usa la lógica de la task
  await runMidnightCleanup();
};
