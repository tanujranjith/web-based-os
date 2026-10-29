const VERSION = "novaos-4.0.0";
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const assets = await (
        await fetch("./precache.json", { cache: "no-store" })
      ).json();
      const cache = await caches.open(VERSION);
      await cache.addAll(assets);
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      await Promise.all(
        (await caches.keys())
          .filter((k) => k.startsWith("novaos-") && k !== VERSION)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE") {
    event.waitUntil(self.skipWaiting());
  }
});
// A single cache version serves the entire module graph, including offline apps.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      return fetch(event.request);
    })(),
  );
});
