// pics.me service worker: makes the app installable and keeps pictures you've
// already seen available instantly. API responses are never cached.
const SHELL = "shell-v1";
const MEDIA = "media-v1";
const MEDIA_MAX = 300;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== MEDIA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(keys.length - MEDIA_MAX, 0))) await cache.delete(key);
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.status === 200) {
    cache.put(request, res.clone());
    if (cacheName === MEDIA) trim(cache);
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  // Pictures are immutable. Video is left to the browser (range requests).
  if (url.pathname.startsWith("/media/")) {
    if (url.pathname.endsWith(".webp")) event.respondWith(cacheFirst(request, MEDIA));
    return;
  }
  // Hashed build assets never change.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, SHELL));
    return;
  }
  // Pages: network first, fall back to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put("/", copy));
          }
          return res;
        })
        .catch(async () => (await caches.match("/")) ?? Response.error()),
    );
  }
});
