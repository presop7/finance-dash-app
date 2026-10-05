import { Platform } from "react-native";
import { isAppleMobileWeb, isAppleTooOldForPush } from "./webPlatform";

// Why notifications can't be turned on here (when notificationsSupported is
// false), as a translation key — shared by Settings and the Reminders screen.
export function notificationsUnavailableKey(): string {
  if (Platform.OS !== "web") return "reminders.expoGoNoNotifications";
  if (isAppleTooOldForPush) return "reminders.webIosTooOldForNotifications";
  if (isAppleMobileWeb) return "reminders.webInstallForNotifications"; // a Safari tab; the installed app can
  return "reminders.webNoNotifications";
}
