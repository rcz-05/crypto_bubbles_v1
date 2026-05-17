/**
 * CoinCanvas service worker.
 *
 * Three cache buckets:
 *   coincanvas-shell-v1   — cache-first for HTML/JS/CSS/fonts/icons
 *   coincanvas-market-v1  — network-first w/ cache fallback for /api/market
 *
 * Endpoints intentionally NOT cached:
 *   /api/telemetry-ingest   — must always reach the server
 *   /api/context            — per-coin
 *   /api/explanation        — POST-only; needs an explicit client cache
 */

const SHELL_CACHE = "coincanvas-shell-v1";
const MARKET_CACHE = "coincanvas-market-v1";
const ALL_CACHES = [SHELL_CACHE, MARKET_CACHE];

const MARKET_FALLBACK_TTL_MS = 24 * 60 * 60 * 1000;

self.addEventListener("install", (event) => {
  // Skip waiting so a fresh SW activates on next page load instead of
  // blocking on existing tabs.
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.add("/")),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop any old versioned caches.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only handle same-origin requests; let CoinGecko / Gemini / external go direct.
  if (url.origin !== self.location.origin) return;

  // Skip the analytics / admin / per-coin endpoints we don't want to cache.
  if (
    url.pathname.startsWith("/api/telemetry-ingest") ||
    url.pathname.startsWith("/api/context") ||
    url.pathname.startsWith("/api/explanation")
  ) {
    return;
  }

  if (url.pathname === "/api/market") {
    event.respondWith(handleMarket(req));
    return;
  }

  // App shell + static assets: cache-first.
  if (
    url.pathname === "/" ||
    url.pathname.startsWith("/_next/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/icon" ||
    url.pathname === "/icon0" ||
    url.pathname === "/apple-icon" ||
    url.pathname === "/favicon.ico"
  ) {
    event.respondWith(cacheFirst(req, SHELL_CACHE));
    return;
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) {
    // Refresh in the background but return the cached copy now.
    fetch(req).then((res) => {
      if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
    }).catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
    return res;
  } catch {
    // No cache, no network — return a minimal fallback.
    return new Response("Offline", { status: 503, statusText: "offline" });
  }
}

async function handleMarket(req) {
  const cache = await caches.open(MARKET_CACHE);
  try {
    // Network-first.
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      const wrapped = new Response(fresh.clone().body, {
        status: fresh.status,
        statusText: fresh.statusText,
        headers: appendDateHeader(fresh.headers),
      });
      cache.put(req, wrapped.clone());
      return fresh;
    }
    throw new Error("upstream " + fresh.status);
  } catch {
    // Network failed — try cache, but only if it's young enough.
    const cached = await cache.match(req);
    if (!cached) return new Response("[]", {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
    const cachedAt = Number(cached.headers.get("x-coincanvas-cached-at") ?? 0);
    if (Number.isFinite(cachedAt) && Date.now() - cachedAt > MARKET_FALLBACK_TTL_MS) {
      return new Response("[]", {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }
    return cached;
  }
}

function appendDateHeader(headers) {
  const next = new Headers(headers);
  next.set("x-coincanvas-cached-at", String(Date.now()));
  return next;
}
