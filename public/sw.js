/* Minimal app-shell service worker for PWA installability.
 * Intentionally does NOT cache navigations — that previously caused stale
 * HTML / dead-chunk loading screens and broke auth state after deploys.
 * The Firebase Messaging SW (firebase-messaging-sw.js) handles push separately.
 */
const CACHE = "cb-shell-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Drop any previously cached shells so stale HTML can't be served.
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Pass-through fetch — no caching of navigations or assets.
self.addEventListener("fetch", () => {});
