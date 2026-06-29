const CACHE_NAME = "gondly-cache-v3";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icons/gondly-icon.png", "/gondly-logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (!shouldHandleRequest(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(request)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok && isHtmlResponse(response)) {
      const copy = response.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put("/", copy);
    }
    return response;
  } catch {
    return (await caches.match("/")) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  return cached || (await network) || Response.error();
}

function shouldHandleRequest(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (request.headers.has("authorization")) return false;
  if (url.pathname.startsWith("/api")) return false;
  return true;
}

function isStaticAsset(request) {
  const url = new URL(request.url);
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/gondly-logo.png" ||
    url.pathname === "/manifest.webmanifest"
  );
}

function isHtmlResponse(response) {
  return response.headers.get("content-type")?.includes("text/html");
}
