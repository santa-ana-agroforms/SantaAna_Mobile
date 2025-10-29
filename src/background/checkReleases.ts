// src/background/checkReleases.ts
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

const TASK_NAME = "check-releases";

// Define la tarea fuera de componentes
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    // TODO: cambia por tu endpoint real
    const resp = await fetch("https://api.tu-backend.com/liberaciones/estado");
    if (!resp.ok) return BackgroundTask.BackgroundTaskResult.Failed;

    const data: { hayLiberacion: boolean; detalle?: string } = await resp.json();

    if (data.hayLiberacion) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "¡Buenas noticias!",
          body: data.detalle ?? "Se liberó un espacio/recurso.",
          data: { tipo: "liberacion" },
        },
        trigger: null, // inmediato
      });
    }

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// Registrar con intervalo mínimo (Android >=15 min; iOS lo respeta a su manera)
export const registerCheckReleasesTaskAsync = async (minimumIntervalMin = 15) => {
  await BackgroundTask.registerTaskAsync(TASK_NAME, {
    minimumInterval: minimumIntervalMin, // mínimo 15 en Android
  });
};

export const unregisterCheckReleasesTaskAsync = async () => {
  await BackgroundTask.unregisterTaskAsync(TASK_NAME);
};
