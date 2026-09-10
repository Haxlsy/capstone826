// Service worker: Web Push handling (always) + offline caching for the
// dashboard so Operations can navigate to Add Job Order / Concerns and queue
// work while offline (see docs/plan/operations-offline-testing-guide.md).

const SW_VERSION = "v1";
const PAGES_CACHE  = `pages-${SW_VERSION}`;
const RSC_CACHE    = `rsc-${SW_VERSION}`;
const STATIC_CACHE = `static-${SW_VERSION}`;
const API_CACHE    = `api-${SW_VERSION}`;
const APP_CACHES   = [PAGES_CACHE, RSC_CACHE, API_CACHE]; // cleared on logout; STATIC kept
const ALL_CACHES   = [...APP_CACHES, STATIC_CACHE];

// Any Operations read endpoint is cached (network-first) so the pages that
// fetch their data client-side — dashboard, technician availability, the
// Add Job Order dropdowns, etc. — still populate offline. All Operations
// data the user already has access to; cleared on logout. Never matches
// /api/health (different prefix) or any non-GET.
function isCacheableApi(pathname) {
  return pathname.startsWith("/api/operations/");
}

const OFFLINE_FALLBACK = "/dashboard/operations";

// ── Lifecycle ────────────────────────────────────────────────────────────────

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => !ALL_CACHES.includes(n) && (n.startsWith("pages-") || n.startsWith("rsc-") || n.startsWith("static-") || n.startsWith("api-")))
          .map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_APP_CACHES") {
    event.waitUntil(Promise.all(APP_CACHES.map((n) => caches.delete(n))));
  }
});

// ── Fetch / caching ──────────────────────────────────────────────────────────

async function networkFirst(request, cacheName) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never touch non-GET (the offline queue's POST/PATCH, /api/health, etc.).
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Build assets. network-first (not cache-first) so a new deploy — or a
  // dev-mode rebuild — never gets pinned to a stale chunk; the cache is only
  // the offline fallback.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // Operations read endpoints — keep client-fetched page data working offline.
  if (isCacheableApi(url.pathname)) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Dashboard / head-technician pages + their RSC payloads. Route by the
  // response content-type so a page and its RSC don't collide on one URL key.
  const isAppRoute = url.pathname.startsWith("/dashboard") || url.pathname.startsWith("/head-technician");
  if (isAppRoute) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res.ok) {
            const ct = res.headers.get("content-type") || "";
            if (ct.includes("text/x-component")) {
              (await caches.open(RSC_CACHE)).put(request, res.clone());
            } else if (ct.includes("text/html")) {
              (await caches.open(PAGES_CACHE)).put(request, res.clone());
            }
          }
          return res;
        } catch (err) {
          const cached = await caches.match(request);
          if (cached) return cached;
          if (request.mode === "navigate") {
            const fallback = await caches.match(OFFLINE_FALLBACK);
            if (fallback) return fallback;
          }
          throw err;
        }
      })()
    );
    return;
  }

  // Everything else: passthrough, unchanged from before.
});

// ── Web Push (unchanged) ─────────────────────────────────────────────────────

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
