/* StudyHub push messaging worker.
   This worker exists solely to receive Web Push messages — it does NOT cache
   the app shell and never intercepts navigations. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "StudyHub", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "StudyHub";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { url: payload.url || "/" },
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) {
          try {
            await client.focus();
            if ("navigate" in client) await client.navigate(target);
            return;
          } catch {
            /* fall through to openWindow */
          }
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })(),
  );
});
