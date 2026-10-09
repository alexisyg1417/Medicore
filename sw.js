/*
 * MediCore Service Worker
 * Cachea los recursos propios de la aplicación y ofrece fallback offline.
 */
const CACHE_PREFIX = "medicore-";
const CACHE_NAME = "medicore-v13-menu-notifications";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./panel.html",
  "./panel.css",
  "./panel.js",
  "./manifest.json",
  "./icons/medicore-icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        // Un recurso opcional ausente no debe impedir que se active el Service Worker.
        await Promise.allSettled(APP_SHELL.map(async (path) => {
          try {
            const response = await fetch(path, { cache: "reload" });
            if (response.ok) await cache.put(path, response);
          } catch (error) {
            console.warn("No se pudo precargar:", path, error);
          }
        }));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Solo interceptamos peticiones GET del mismo origen.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // CSS siempre se solicita primero a la red para evitar estilos antiguos guardados en caché.
  if (url.pathname.endsWith(".css")) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).then((response) => {
        if (response && response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});