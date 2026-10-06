"use strict";

const CACHE = "up1b-calc-v4";
const ASSETS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // Never intercept the service worker script itself — the browser must
  // always be able to see new bytes over the network to update us.
  if (url.pathname.endsWith("sw.js")) return;

  // Page loads: network-first so new deploys reach users immediately.
  // Cache is only the offline fallback.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then((r) => r || caches.match("./")))
    );
    return;
  }

  // Static assets (own files + Font Awesome CDN): cache-first with
  // background re-cache so they self-heal after a deploy.
  e.respondWith(
    caches.match(e.request)
      .then((cached) => {
        const fetched = fetch(e.request)
          .then((res) => {
            if (res.ok && (url.origin === location.origin || url.host === "cdnjs.cloudflare.com")) {
              const clone = res.clone();
              caches.open(CACHE).then((c) => c.put(e.request, clone));
            }
            return res;
          })
          .catch(() => cached);
        return cached || fetched;
      })
  );
});
