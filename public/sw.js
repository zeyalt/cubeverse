const CACHE_VERSION = "2026-09-07-2";
const CACHE_PREFIX = "cubeverse-";
const SHELL_CACHE = `${CACHE_PREFIX}shell-${CACHE_VERSION}`;
const IMMUTABLE_CACHE = `${CACHE_PREFIX}immutable-${CACHE_VERSION}`;
const PUBLIC_DATA_CACHE = `${CACHE_PREFIX}public-data-${CACHE_VERSION}`;
const APP_SHELL = ["/", "/manifest.json"];
const NETWORK_TIMEOUT_MS = 4_000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.allSettled(
        APP_SHELL.map(async (url) => {
          // Do not persist an authenticated install response as the shared shell.
          const request = new Request(url, { cache: "reload", credentials: "omit" });
          const response = await fetch(request);
          if (isCacheable(response)) await cache.put(url, response);
        })
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const current = new Set([SHELL_CACHE, IMMUTABLE_CACHE, PUBLIC_DATA_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && !current.has(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request, IMMUTABLE_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isPublicDataRequest(request, url)) {
    event.respondWith(networkFirstPublicData(request));
  }
});

function isImmutableAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

function isPublicDataRequest(request, url) {
  const accept = request.headers.get("accept") || "";
  return url.pathname.startsWith("/api/") || accept.includes("application/json");
}

function isCacheable(response) {
  return response.ok && (response.type === "basic" || response.type === "cors");
}

function isExplicitlyPublic(response) {
  if (!isCacheable(response)) return false;
  const cacheControl = response.headers.get("cache-control") || "";
  if (/\b(?:private|no-store)\b/i.test(cacheControl)) return false;
  return (
    response.headers.get("x-cubeverse-cache") === "public" ||
    /\bpublic\b/i.test(cacheControl)
  );
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheable(response)) {
    await safePut(cache, request, response.clone());
  }
  return response;
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetchWithTimeout(request);
    // Personalized HTML is never cached unless the server explicitly declares it public.
    if (isExplicitlyPublic(response)) await safePut(cache, request, response.clone());
    return response;
  } catch {
    return (
      (await cache.match(request)) ||
      (await cache.match("/")) ||
      new Response(offlineDocument(), {
        status: 503,
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    );
  }
}

async function networkFirstPublicData(request) {
  const cache = await caches.open(PUBLIC_DATA_CACHE);
  try {
    const response = await fetchWithTimeout(request);
    // GET alone is not proof that data is non-sensitive. Cache only an explicit
    // public response and never requests carrying authorization.
    if (!request.headers.has("authorization") && isExplicitlyPublic(response)) {
      await safePut(cache, request, response.clone());
    }
    return response;
  } catch {
    if (request.headers.has("authorization")) {
      return new Response(JSON.stringify({ error: "Offline" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    return (
      (await cache.match(request)) ||
      new Response(JSON.stringify({ error: "Offline and no cached public response" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      })
    );
  }
}

async function fetchWithTimeout(request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function safePut(cache, request, response) {
  try {
    await cache.put(request, response);
  } catch {
    // A cache quota failure must not turn a successful network request into an error.
  }
}

function offlineDocument() {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CubeVerse offline</title></head>
  <body><main><h1>You're offline</h1><p>Reconnect to load this page.</p></main></body>
</html>`;
}
