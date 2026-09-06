// Minimal service worker: exists solely to receive Web Push events while the
// app is closed/backgrounded and to route a notification tap to the right job.

self.addEventListener("push", (event) => {
  let payload = { title: "826", body: "You have a new update." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // leave default payload
  }

  const url = payload.url || "/head-technician";

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/head-technician";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      for (const client of clients) {
        if ("focus" in client && "navigate" in client) {
          client.focus();
          return client.navigate(url);
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
