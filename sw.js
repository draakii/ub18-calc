"use strict";

const CACHE = "up1b-calc-v3";
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

// Cache-first with network fallback; cache successful GETs for offline use.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request)
      .then((cached) => {
        const fetched = fetch(e.request)
          .then((res) => {
            if (res.ok) {
              const u = new URL(e.request.url);
              // Cache own files + the Font Awesome CDN (css + font files)
              if (u.origin === location.origin || u.host === "cdnjs.cloudflare.com") {
                const clone = res.clone();
                caches.open(CACHE).then((c) => c.put(e.request, clone));
              }
            }
            return res;
          })
          .catch(() => cached);
        return cached || fetched;
      })
  );
});
