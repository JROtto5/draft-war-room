/* Draft War Room — service worker.
   MIT License — see LICENSE. © 2026 JROtto5 / Draft War Room. */
const CACHE = "war-room-v59";
const CORE = ["./", "./index.html", "./styles.css", "./data.js", "./engine.js", "./core.js", "./season.js", "./win.js", "./simx.js", "./views.js", "./wire.js", "./boot.js", "./manifest.json", "./icon.svg", "./icon-192.png", "./icon-512.png", "./fonts/Sora-400.woff2", "./fonts/JetBrainsMono-400.woff2"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Network-first for our own pages (so deploys show up), cache fallback offline.
// Cache-first for everything else (fonts).
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const sameOrigin = new URL(e.request.url).origin === location.origin;
  if (sameOrigin) {
    e.respondWith(
      fetch(e.request).then(res => {
        const cp = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, cp)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request, {ignoreSearch: true}).then(r => r || caches.match("./index.html")))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        const cp = res.clone();
        caches.open(CACHE).then(async c => {
          await c.put(e.request, cp);
          if (Math.random() < 0.02) {                    // occasional trim
            const keys = await c.keys();
            const foreign = keys.filter(k => new URL(k.url).origin !== location.origin);
            if (foreign.length > 400)
              await Promise.all(foreign.slice(0, foreign.length - 350).map(k => c.delete(k)));
          }
        }).catch(() => {});
        return res;
      }).catch(() => new Response("", {status: 503})))
    );
  }
});
