const CACHE_NAME = "gondly-cache-v5";
const APP_SHELL = ["/index.html", "/manifest.webmanifest", "/icons/gondly-icon-192x192.png", "/icons/apple-touch-icon.png", "/gondly-logo-small.webp"];
const STATIC_PUBLIC_ASSETS = new Set([
  "/manifest.webmanifest",
  "/gondly-logo-small.webp",
  "/gondly-logo-small.png",
  "/gondly-logo.webp",
  "/gondly-mockup.webp",
]);

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
  const url = new URL(request.url);
  const editorial = /^\/(blog|receitas|guias|sobre)(\/|$)/.test(url.pathname);
  try {
    const response = await fetch(request);
    if (editorial && !url.search && response.ok && isHtmlResponse(response)) {
      const copy = response.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(url.href, copy);
    }
    return response;
  } catch {
    const cached = editorial ? await caches.match(url.href) : await caches.match("/index.html");
    return cached || new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sem conexão | Gondly</title><h1>Você está sem conexão</h1><p>Esta página ainda não está disponível offline. Reconecte e tente novamente.</p></html>', {status:503, headers:{"Content-Type":"text/html; charset=utf-8"}});
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
    STATIC_PUBLIC_ASSETS.has(url.pathname)
  );
}

function isHtmlResponse(response) {
  return response.headers.get("content-type")?.includes("text/html");
}
