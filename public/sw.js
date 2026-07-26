const CACHE_VERSION = "bitcase-shell-v9";
const SHELL_ASSETS = [
  "/offline.html",
  "/favicon.svg",
  "/app-icon.svg",
  "/app-icon-192.png",
  "/app-icon-512.png",
  "/greek-philosopher-walk.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/signin-with-chatgpt")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match("/offline.html");
        return offline || Response.error();
      }),
    );
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/assets/") ||
    /\.(?:css|js|woff2?|svg|png|jpg|jpeg|webp)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (!response.ok || response.type !== "basic") return response;
            const copy = response.clone();
            void caches
              .open(CACHE_VERSION)
              .then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});
