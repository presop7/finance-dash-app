// Fi-Track's service worker. Browsers on phones only show notifications
// through one (new Notification() throws on Android Chrome), and web push
// (daily reminders sent by the backend, see backend/routes/push.py) arrives
// here even when the app is closed. Deliberately no "fetch" handler: nothing
// is cached, so a deploy is never hidden behind an old copy of the app.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  const { title = "Fi-Track", body = "" } = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(title, { body, icon: "/icon-192.png", badge: "/icon-192.png" }));
});

// Tapping a notification brings the app forward (or opens it).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows[0];
      return open ? open.focus() : self.clients.openWindow("/");
    }),
  );
});
