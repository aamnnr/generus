/* Service worker Generus — Fase 1 (PWA dasar).
 *
 * - Aset build Next (/_next/static, berhash & immutable), ikon, WASM pembaca QR: cache-first.
 * - Navigasi halaman: selalu ke jaringan; bila offline tampilkan /offline.html.
 * - Pengecualian: /pindai (kerangka pemindai tanpa data pribadi) disimpan agar
 *   bisa dibuka offline; data peserta ada di IndexedDB, bukan di cache ini.
 * - Halaman lain yang berisi data pribadi TIDAK disimpan di cache perangkat.
 * Naikkan VERSION bila isi file ini berubah agar cache lama dibersihkan.
 */
const VERSION = "v6";
const STATIC_CACHE = `generus-static-${VERSION}`;
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("generus-") && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return url.origin === self.location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/vendor/"));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Kerangka pemindai: dari navigasi langsung, atau "dipanaskan" oleh halaman
  // pemindai sendiri (navigasi di dalam aplikasi tidak melewati service worker).
  const warm = request.headers.get("x-generus-warm") === "1";
  if (url.pathname === "/pindai" && (request.mode === "navigate" || warm)) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          // Simpan hanya kerangka asli (bukan redirect ke /login).
          if (response.ok && !response.redirected) {
            const cache = await caches.open(STATIC_CACHE);
            await cache.put("/pindai", response.clone());
          }
          return response;
        })
        .catch(async () => (await caches.match("/pindai")) ?? caches.match("/offline.html")),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
  }
});
