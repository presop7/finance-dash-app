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

// Daily reminders are OS-scheduled (unlike the other alert types, which are
// only evaluated reactively while the app's JS is running — see
// evaluateAlerts) so they still fire at the set time even if the app hasn't
// been opened that day. Keyed by the alert rule's own id as the
// notification identifier, so re-saving a rule (new time) or toggling it
// off can address the exact notification to replace/cancel instead of
// stacking up duplicates.
export async function scheduleDailyReminder(
  id: string,
  hour: number,
  minute: number,
  title: string,
  body: string,
) {
  const Notifications = getNotifications();
  if (!Notifications) return;
  const granted = await hasNotificationPermission();
  if (!granted) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
}

export async function cancelDailyReminder(id: string) {
  const Notifications = getNotifications();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}
