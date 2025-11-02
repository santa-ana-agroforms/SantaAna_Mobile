// src/background/dailyMaintenance.ts
import * as BackgroundTask from "expo-background-task";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";

// Usa SecureStore para el “último día limpiado” (evitamos leer la tabla kv porque la purgamos)
const LAST_MAINT_KEY = "lastMaintenanceDay";
const TASK_ID = "daily-maintenance";

// YYYY-MM-DD usando la hora local del teléfono
const todayLocalYMD = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// --- Hace el purge de forma segura en background (una conexión fresca, sin execAsync) ---
const purgeAndLogout = async () => {
  // Import dinámico dentro del task (JS headless) y conexión nueva
  const SQLite = await import("expo-sqlite");
  const db = await SQLite.openDatabaseAsync("forms.db", { useNewConnection: true });

  // TODO: ajustá la lista de tablas según tu app
  await db.withTransactionAsync(async () => {
    // DATASETS
    await db.runAsync(`DELETE FROM local_dataset_value`).catch(() => {});
    await db.runAsync(`DELETE FROM local_dataset_field`).catch(() => {});
    // GRUPOS
    await db.runAsync(`DELETE FROM local_group_fields`).catch(() => {});
    await db.runAsync(`DELETE FROM local_groups`).catch(() => {});
    // FORM SNAPSHOT + USO
    await db.runAsync(`DELETE FROM field`).catch(() => {});
    await db.runAsync(`DELETE FROM page`).catch(() => {});
    await db.runAsync(`DELETE FROM form`).catch(() => {});
    await db.runAsync(`DELETE FROM category`).catch(() => {});
    await db.runAsync(`DELETE FROM form_usage`).catch(() => {});
    // ENTRADAS LOCALES
    await db.runAsync(`DELETE FROM form_entries`).catch(() => {});
    // KV opcional (quitamos sólo llaves de notificaciones/periodos)
    await db.runAsync(`DELETE FROM kv WHERE k LIKE 'noti.%' OR k LIKE 'period.%'`).catch(() => {});
  });

  // Limpia credenciales → en tu axios interceptor ya manejás 401 sin refresh
  await SecureStore.deleteItemAsync("ACCESS_KEY").catch(() => {});
  await SecureStore.deleteItemAsync("REFRESH_KEY").catch(() => {});
  await SecureStore.setItemAsync(LAST_MAINT_KEY, todayLocalYMD()).catch(() => {});
};

// Define el task (SIEMPRE en top-level)
TaskManager.defineTask(TASK_ID, async () => {
  try {
    const last = await SecureStore.getItemAsync(LAST_MAINT_KEY);
    const today = todayLocalYMD();
    if (last === today) {
      // Ya limpiamos hoy; no hacer nada
      return BackgroundTask.BackgroundTaskResult.Success;
    }
    await purgeAndLogout();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    console.error("[daily-maintenance] failed:", e);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// Llamá esto en el bootstrap (por ej. en App.tsx useEffect)
export const ensureDailyMaintenanceRegistered = async () => {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;

  // Intervalo mínimo: el SO decide la hora exacta; con 60 min típicamente cae de noche en iOS/Android
  await BackgroundTask.registerTaskAsync(TASK_ID, { minimumInterval: 60 });
  return true;
};

// “Catch-up” por si el SO no corrió el task durante la noche (app abierta/reabierta)
export const runMidnightCatchUpIfNeeded = async () => {
  const last = await SecureStore.getItemAsync(LAST_MAINT_KEY);
  const today = todayLocalYMD();
  if (last !== today) {
    try {
      await purgeAndLogout();
    } catch (e) {
      console.error("[daily-maintenance] catch-up failed:", e);
    }
  }
};
