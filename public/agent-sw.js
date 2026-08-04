/*
 * BiteExpress Agents service worker.
 *
 * Scope is deliberately push-only: `push` and `notificationclick`. There is no
 * fetch handler and no caching of any kind. A stale cache in a money app is
 * worse than no offline support, so this file must never grow one.
 */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // Non-JSON payload: fall through to the defaults below.
  }

  const title = payload.title || "BiteExpress Agents";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: (payload.data && payload.data.url) || payload.url || "/earnings" },
    tag: payload.tag || undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/earnings";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if ("focus" in client) {
            if ("navigate" in client) client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
