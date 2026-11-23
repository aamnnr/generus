import { brand, isKliik } from "@/lib/brand";

// Halaman yang ditampilkan service worker (public/sw.js) saat navigasi gagal karena offline.
// Dibuat saat build mengikuti merek aktif (GET tanpa request = statis); ikon
// /icons/icon-192.png ikut di-precache.

const C = isKliik
  ? { bg: "#F3F6FB", fg: "#1F2440", muted: "#5B6178", primary: "#1A2189", darkBg: "#11163A" }
  : { bg: "#F6F3EC", fg: "#1C2620", muted: "#525252", primary: "#1A4A39", darkBg: "#0a0a0a" };

const html = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="${brand.color}" />
    <title>Offline · ${brand.name}</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        background: ${C.bg};
        color: ${C.fg};
        padding: 16px;
        box-sizing: border-box;
      }
      @media (prefers-color-scheme: dark) { body { background: ${C.darkBg}; color: #ededed; } p { color: #b5b9c9; } }
      main { max-width: 22rem; text-align: center; }
      .logo { width: 64px; height: 64px; border-radius: 16px; margin: 0 auto 16px; display: block; }
      h1 { font-size: 1.25rem; margin: 0 0 8px; }
      p { color: ${C.muted}; line-height: 1.5; margin: 0 0 20px; }
      button {
        font: inherit; font-weight: 700; color: #fff; background: ${C.primary};
        border: 0; border-radius: 999px; padding: 12px 22px; cursor: pointer;
      }
    </style>
  </head>
  <body>
    <main>
      <img class="logo" src="/icons/icon-192.png" alt="${brand.name}" />
      <h1>Anda sedang offline</h1>
      <p>Halaman ini butuh koneksi internet. Periksa sinyal atau Wi-Fi, lalu coba lagi. Pemindai QR tetap bisa dipakai tanpa sinyal bila sudah pernah dibuka.</p>
      <button type="button" onclick="location.reload()">Coba lagi</button>
    </main>
    <script>
      // Muat ulang otomatis saat koneksi kembali. Selain event "online", cek
      // berkala karena HP bisa tetap "online" tanpa akses internet (sinyal lemah).
      addEventListener("online", () => location.reload());
      setInterval(async () => {
        try {
          const res = await fetch("/manifest.webmanifest", { cache: "no-store" });
          if (res.ok) location.reload();
        } catch {
          // Masih offline.
        }
      }, 5000);
    </script>
  </body>
</html>
`;

export function GET() {
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
