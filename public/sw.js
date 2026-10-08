/*
 * Offline support for the installed app. Scope: the folder this file is
 * served from (/delta/ on GitHub Pages).
 * - Page and data (index.html, worlds, live conditions): network first, so
 *   a new deploy shows up at once; the cache is the fallback offline.
 * - Hashed build assets, models and icons: cache first (they never change
 *   under the same URL).
 */
const VERSION = "delta-v2";
const SHELL = ["./", "./index.html", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

const immutable = (url) => /\/assets\/|\/models\/|\/icons\/|\.woff2?$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Only our own files; CDNs and APIs go straight to the network
  if (url.origin !== self.location.origin) return;
  if (immutable(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match("./index.html")))
  );
});
