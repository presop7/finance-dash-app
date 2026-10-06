// Web version of utils/notifications.ts (same exports; Metro picks this file
// for the web build). Uses the browser's Notification API through the
// service worker in public/sw.js.
//
// Daily reminders use web push: the reminder times are sent to the backend
// (routes/push.py), which pushes each one at its time, so it arrives even
// with the app closed. Android browsers support this in a normal tab; on
// iPhone only the installed web app ("Add to Home Screen", iOS 16.4+) can —
// in a Safari tab `Notification` doesn't exist, so notificationsSupported is
// false there.
import { api } from "../services/api";

export const notificationsSupported =
  typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;

let registration: Promise<ServiceWorkerRegistration> | null = null;
function worker() {
  registration ??= navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready);
  return registration;
}

// Must run from a tap (browsers ignore permission requests that aren't).
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  const granted = Notification.permission === "granted" || (await Notification.requestPermission()) === "granted";
  if (granted) syncReminders();
  return granted;
}

export async function hasNotificationPermission(): Promise<boolean> {
  return notificationsSupported && Notification.permission === "granted";
}

export async function sendLocalNotification(title: string, body: string) {
  if (!(await hasNotificationPermission())) return;
  const reg = await worker();
  await reg.showNotification(title, { body, icon: "/icon-192.png", badge: "/icon-192.png" });
}

// The current daily reminders, keyed by rule id. useDailyReminderSync
// schedules/cancels them one by one; the whole set is sent to the server
// shortly after the last change.
const reminders = new Map<string, number>(); // id -> minutes after midnight
let text = { title: "", body: "" };
let syncTimer: ReturnType<typeof setTimeout> | undefined;

export async function scheduleDailyReminder(id: string, hour: number, minute: number, title: string, body: string) {
  reminders.set(id, hour * 60 + minute);
  text = { title, body };
  syncReminders();
}

export async function cancelDailyReminder(id: string) {
  if (reminders.delete(id)) syncReminders();
}

function syncReminders() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    pushReminders().catch(() => {}); // offline / signed out: the next change or app start retries
  }, 500);
}

async function pushReminders() {
  if (!(await hasNotificationPermission())) return;
  const reg = await worker();
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    if (reminders.size === 0) return; // nothing to deliver, no need to subscribe
    const { key } = await api.get<{ key: string }>("/push/public-key");
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(key),
    });
  }
  const { endpoint, keys } = subscription.toJSON();
  await api.put("/push/subscription", {
    endpoint,
    keys,
    times: [...reminders.values()],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    title: text.title,
    body: text.body,
  });
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

// The monthly report's reminder is a tip on the web (first opening of a
// month); a server push for it can come later.
export async function scheduleMonthlyReport(_title: string, _body: string) {}
export async function cancelMonthlyReport() {}
