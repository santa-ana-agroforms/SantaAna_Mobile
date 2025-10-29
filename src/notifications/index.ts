// src/notifications/index.ts
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Muestra banners/lista cuando la app está en foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const notifyNow = async (title: string, body?: string) => {
  try {
    await ensureNotificationPermissionsAsync();
  } catch {}
  console.log("Sending local notification:", { title, body });
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null, // inmediato
  });
};

export const ensureNotificationPermissionsAsync = async (): Promise<boolean> => {
  // ANDROID 13+: crear canal ANTES para que salga el prompt del SO
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "General",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 150, 100, 150],
      lightColor: "#FF231F7C",
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
};

// Obtener ExpoPushToken SIN expo-device (maneja simulador/emulador con try/catch)
export const getExpoPushTokenSafeAsync = async (): Promise<string | null> => {
  try {
    // Asegurá permisos (y canal en Android) antes de pedir token
    const ok = await ensureNotificationPermissionsAsync();
    if (!ok) return null;

    // projectId de EAS (necesario en SDK 53+)
    const projectId =
      // en Dev Client / build
      Constants?.expoConfig?.extra?.eas?.projectId ??
      // fallback cuando corres en Expo Go moderno
      Constants?.easConfig?.projectId;

    if (!projectId) return null;

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data || null;
  } catch {
    // Casos típicos: simulador/emulador, sin red, o credenciales faltantes
    return null;
  }
};

// -------- Helpers para programar notificaciones locales --------

// Repite cada N segundos (iOS exige >=60 cuando repeats=true)
export const scheduleIntervalNotification = async (
  seconds: number,
  repeats = true,
  content: Notifications.NotificationContentInput
) => {
  return Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats,
      channelId: Platform.OS === "android" ? "default" : undefined,
    },
  });
};

// Diario a HH:mm (hora/minuto locales)
export const scheduleDailyAt = async (
  hour: number,
  minute: number,
  content: Notifications.NotificationContentInput
) => {
  return Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: Platform.OS === "android" ? "default" : undefined,
    },
  });
};

// Semanal (1=Domingo ... 7=Sábado)
export const scheduleWeeklyAt = async (
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7,
  hour: number,
  minute: number,
  content: Notifications.NotificationContentInput
) => {
  return Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday,
      hour,
      minute,
      channelId: Platform.OS === "android" ? "default" : undefined,
    },
  });
};

// Notifical a una hora específica del día de hoy (si ya pasó, no notifica)
export const scheduleTodayAt = async (
  hour: number,
  minute: number,
  title: string,
  body?: string
) => {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) {
    // ya pasó hoy
    return null;
  }
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.floor(diffMs / 1000),
      repeats: false,
      channelId: Platform.OS === "android" ? "default" : undefined,
    },
  });
};

export const cancelNotification = async (id: string) => {
  await Notifications.cancelScheduledNotificationAsync(id);
};

export const cancelAllNotifications = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};
