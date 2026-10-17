/* MediCore PWA — caché de shell y funcionamiento sin conexión */
const CACHE_NAME = "medicore-shell-v21";
const SCOPE_URL = self.registration.scope;

// Rutas relativas al alcance real del Service Worker (funciona también si la app
// se publica en una subruta). Los recursos opcionales que no existan no bloquean la instalación.
const APP_SHELL = [
  "./",
  "./index.html",
  "./medicore-redesign.css",
  "./demo.html",
  "./demo.css",
  "./demo.js",
  "./panel.html",
  "./panel.css",
  "./panel.js",
  "./supabase-config.js",
  "./supabase-auth.js",
  "./manifest.json",
  "./icons/medicore-icon.svg",
  "./icons/medicore-icon-192.png",
  "./icons/medicore-icon-512.png"
];

const toScopeURL = (path) => new URL(path, SCOPE_URL).href;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const results = await Promise.allSettled(APP_SHELL.map(async (path) => {
      const url = toScopeURL(path);
      try {
        const response = await fetch(url, { cache: "reload" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} para ${url}`);
        }
        // Solo guardar respuestas válidas del mismo origen.
        if (new URL(url).origin === self.location.origin) {
          await cache.put(url, response.clone());
        }
        return url;
      } catch (error) {
        console.warn("[MediCore SW] No se pudo precargar:", url, error);
        return null;
      }
    }));

    const cachedCount = results.filter((result) =>
      result.status === "fulfilled" && result.value !== null
    ).length;

    console.info(`[MediCore SW] Precarga terminada: ${cachedCount}/${APP_SHELL.length} recursos guardados.`);
    // No fallar la instalación por un recurso opcional ausente.
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith("medicore-") && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
    console.info("[MediCore SW] Activo. Caché:", CACHE_NAME);
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Las páginas se solicitan primero a la red; si no hay conexión, usar la
  // copia exacta de esa página y nunca reemplazar demo/panel por index.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch (_) {
        const pathname = url.pathname.replace(/\/$/, "");
        let fallback = toScopeURL("./index.html");
        if (pathname.endsWith("/demo") || pathname.endsWith("/demo.html")) {
          fallback = toScopeURL("./demo.html");
        } else if (pathname.endsWith("/panel") || pathname.endsWith("/panel.html")) {
          fallback = toScopeURL("./panel.html");
        }
        const cached = await caches.match(fallback);
        return cached || new Response(
          "No hay conexión. Abre MediCore cuando vuelvas a estar en línea para guardar esta página.",
          { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
        );
      }
    })());
    return;
  }

  // Para recursos estáticos, usar caché primero; actualizarla cuando la red responda.
  if (["style", "script", "image", "font"].includes(request.destination)) {
    event.respondWith((async () => {
      const cached = await caches.match(request, { ignoreSearch: true });
      const networkPromise = fetch(request).then(async (response) => {
        if (response.ok && response.type !== "opaque") {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      });

      if (cached) {
        // La actualización en segundo plano no debe impedir responder desde caché.
        event.waitUntil(networkPromise.catch((error) =>
          console.warn("[MediCore SW] Actualización de caché omitida:", request.url, error)
        ));
        return cached;
      }

      try {
        return await networkPromise;
      } catch (_) {
        return new Response("Recurso no disponible sin conexión.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })());
    return;
  }

  // Otras peticiones same-origin: red primero y caché como respaldo.
  event.respondWith((async () => {
    try {
      return await fetch(request);
    } catch (_) {
      return (await caches.match(request)) || new Response("Recurso no disponible sin conexión.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
