/* MediCore PWA — caché seguro del shell y respaldo sin conexión */
const CACHE_NAME = "medicore-shell-v24";
const SCOPE_URL = self.registration.scope;

const APP_SHELL = [
  "./",
  "./index.html",
  "./medicore-redesign.css",
  "./script.js",
  "./demo.html",
  "./demo.css",
  "./demo.js",
  "./panel.html",
  "./panel.css",
  "./panel.js",
  "./reportes.html",
  "./reportes.js",
  "./supabase-config.js",
  "./supabase-auth.js",
  "./manifest.json",
  "./icons/medicore-icon.svg",
];

const toScopeURL = (path) => new URL(path, SCOPE_URL).href;

async function cacheSafely(cache, request, response) {
  try {
    if (response && response.ok && response.type !== "opaque") {
      await cache.put(request, response.clone());
      return true;
    }
  } catch (error) {
    // Un fallo de cuota o almacenamiento nunca debe romper una respuesta de red.
    console.warn("[MediCore SW] No se pudo guardar en caché:", request.url || request, error);
  }
  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const results = await Promise.allSettled(APP_SHELL.map(async (path) => {
        const url = toScopeURL(path);
        try {
          const response = await fetch(url, { cache: "reload" });
          if (!response.ok) {
            console.warn("[MediCore SW] Recurso no disponible:", url, response.status);
            return false;
          }
          return await cacheSafely(cache, url, response);
        } catch (error) {
          console.warn("[MediCore SW] No se pudo precargar:", url, error);
          return false;
        }
      }));
      const cachedCount = results.filter((result) =>
        result.status === "fulfilled" && result.value === true
      ).length;
      console.info(`[MediCore SW] Precarga: ${cachedCount}/${APP_SHELL.length} recursos guardados.`);
    } catch (error) {
      // No bloquear la instalación por un problema temporal de Cache Storage.
      console.error("[MediCore SW] No se pudo abrir Cache Storage:", error);
    } finally {
      await self.skipWaiting();
    }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys
        .filter((key) => key.startsWith("medicore-") && key !== CACHE_NAME)
        .map(async (key) => {
          try { await caches.delete(key); }
          catch (error) { console.warn("[MediCore SW] No se pudo borrar caché antiguo:", key, error); }
        }));
    } catch (error) {
      console.warn("[MediCore SW] No se pudieron limpiar cachés antiguos:", error);
    }
    await self.clients.claim();
    console.info("[MediCore SW] Activo. Caché:", CACHE_NAME);
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // No almacenar respuestas de Supabase, autenticación ni otros orígenes:
  // el caché offline se limita a recursos públicos de la propia aplicación.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          try {
            const cache = await caches.open(CACHE_NAME);
            await cacheSafely(cache, request, response);
          } catch (error) {
            console.warn("[MediCore SW] No se pudo actualizar caché de página:", error);
          }
        }
        return response;
      } catch (_) {
        const pathname = url.pathname.replace(/\/$/, "");
        const candidates = [request, url.href];
        if (pathname.endsWith("/demo") || pathname.endsWith("/demo.html")) {
          candidates.push(toScopeURL("./demo.html"));
        } else if (pathname.endsWith("/panel") || pathname.endsWith("/panel.html")) {
          candidates.push(toScopeURL("./panel.html"));
        } else {
          candidates.push(toScopeURL("./index.html"), toScopeURL("./"));
        }

        for (const candidate of candidates) {
          try {
            const cached = await caches.match(candidate, { ignoreSearch: true });
            if (cached) return cached;
          } catch (error) {
            console.warn("[MediCore SW] Error al leer caché:", error);
          }
        }
        return new Response(
          "No hay conexión y esta página aún no está guardada. Conéctate una vez y vuelve a intentarlo.",
          { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
        );
      }
    })());
    return;
  }

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      // Cachear solo archivos estáticos, no llamadas API ni datos dinámicos.
      if (response && response.ok && ["style", "script", "image", "font"].includes(request.destination)) {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cacheSafely(cache, request, response);
        } catch (error) {
          console.warn("[MediCore SW] Caché no disponible; se devuelve la respuesta de red:", error);
        }
      }
      return response;
    } catch (_) {
      try {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
      } catch (error) {
        console.warn("[MediCore SW] Error al consultar caché:", error);
      }
      return new Response("Recurso no disponible sin conexión.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
