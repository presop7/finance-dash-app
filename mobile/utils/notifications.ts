import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import type * as NotificationsModule from "expo-notifications";

// expo-notifications registers a push-token listener at module scope, and that
// path throws outright on Android in Expo Go (remote push was removed from
// Expo Go in SDK 53). So the module is loaded lazily and skipped entirely
// there — otherwise merely importing it crashes the app on launch.
// iOS Expo Go only warns, so local notifications still work there.
export const notificationsSupported =
  Platform.OS !== "web" && !(Platform.OS === "android" && isRunningInExpoGo());

let cachedModule: typeof NotificationsModule | null = null;
let handlerConfigured = false;

function getNotifications(): typeof NotificationsModule | null {
  if (!notificationsSupported) return null;

  if (!cachedModule) {
    cachedModule = require("expo-notifications") as typeof NotificationsModule;
  }

  if (!handlerConfigured) {
    handlerConfigured = true;
    cachedModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }

  return cachedModule;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function hasNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

export async function sendLocalNotification(title: string, body: string) {
  const Notifications = getNotifications();
  if (!Notifications) return;
  const granted = await hasNotificationPermission();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
}
