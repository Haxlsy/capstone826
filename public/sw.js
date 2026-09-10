// Service worker: Web Push handling (always) + offline caching for the
// dashboard so Operations can navigate to Add Job Order / Concerns and queue
// work while offline (see docs/plan/operations-offline-testing-guide.md).

const SW_VERSION = "v2";
const PAGES_CACHE  = `pages-${SW_VERSION}`;
const RSC_CACHE    = `rsc-${SW_VERSION}`;
const STATIC_CACHE = `static-${SW_VERSION}`;
const API_CACHE    = `api-${SW_VERSION}`;
const APP_CACHES   = [PAGES_CACHE, RSC_CACHE, API_CACHE]; // cleared on logout; STATIC kept
const ALL_CACHES   = [...APP_CACHES, STATIC_CACHE];

const OFFLINE_PAGE = "/offline";

// Any Operations read endpoint is cached (network-first) so the pages that
// fetch their data client-side — dashboard, technician availability, the
// Add Job Order dropdowns, etc. — still populate offline. All Operations
// data the user already has access to; cleared on logout. Never matches
// /api/health (different prefix) or any non-GET.
function isCacheableApi(pathname) {
  return pathname.startsWith("/api/operations/");
}

// A Next.js RSC/flight request for a soft <Link> navigation. Its URL carries
// a volatile ?_rsc=<hash>, so it's cached/matched under the bare pathname.
function isRscRequest(request, url) {
  return (
    request.headers.get("RSC") === "1" ||
    (request.headers.get("Accept") || "").includes("text/x-component") ||
    url.searchParams.has("_rsc")
  );
}

function bareKey(url) {
  return url.origin + url.pathname;
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGES_CACHE).then((c) => c.add(OFFLINE_PAGE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (n) =>
              !ALL_CACHES.includes(n) &&
              (n.startsWith("pages-") || n.startsWith("rsc-") || n.startsWith("static-") || n.startsWith("api-"))
          )
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

  // Build assets — network-first so a new deploy never gets pinned to a stale
  // chunk; the cache is only the offline fallback.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // Operations read endpoints — keep client-fetched page data working offline.
  if (isCacheableApi(url.pathname)) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  const isAppRoute =
    url.pathname.startsWith("/dashboard") ||
    url.pathname.startsWith("/head-technician") ||
    url.pathname === OFFLINE_PAGE;

  if (isAppRoute || request.mode === "navigate") {
    const rsc = isRscRequest(request, url);
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res.ok) {
            if (rsc) {
              (await caches.open(RSC_CACHE)).put(bareKey(url), res.clone());
            } else {
              const ct = res.headers.get("content-type") || "";
              if (ct.includes("text/html")) {
                (await caches.open(PAGES_CACHE)).put(bareKey(url), res.clone());
              }
            }
          }
          return res;
        } catch (err) {
          if (rsc) {
            const cached = await caches.match(bareKey(url));
            if (cached) return cached;
            // No cached flight payload — let it fail so the Next.js router
            // falls back to a full-document navigation, which the branch
            // below can satisfy from PAGES_CACHE / the offline page.
            throw err;
          }
          const cachedPage = await caches.match(bareKey(url));
          if (cachedPage) return cachedPage;
          const offline = await caches.match(OFFLINE_PAGE);
          if (offline) return offline;
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
