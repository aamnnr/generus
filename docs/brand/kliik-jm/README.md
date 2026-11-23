# Aset merek KLIIK JM

Logo dari klien (`sumber-logo-klien.png`) digambar ulang sebagai vektor tanpa mengubah bentuk huruf
maupun warna. Buka `pratinjau.html` untuk melihat semua varian. **Status: menunggu persetujuan klien**
— belum dipasang di aplikasi.

| File | Pakai untuk |
|---|---|
| `kliik-jm-logo.svg` / `-putih` | Logo lengkap dengan tagline (login, splash, dokumen) — latar terang / gelap |
| `kliik-jm-wordmark.svg` / `-putih` | Tanpa tagline (header, sidebar) |
| `*-mono.svg`, `*-mono-putih.svg` | Satu warna (cetak, stempel, di atas foto) |
| `kliik-jm-icon.svg` / `-gelap` | Ikon aplikasi |
| `kliik-jm-favicon.svg` | Favicon (16–32 px, latar navy, garis tebal) |
| `kliik-jm-maskable.svg` | Ikon PWA Android (isi di zona aman 80%) |
| `kliik-jm-apple-touch.svg` | apple-touch-icon (iOS) |
| `png/` | Ekspor PNG siap pakai (icon-192/512, maskable-512, apple-touch-icon 180, favicon-16/32, logo) |

Warna: navy `#1A2189` (utama: teks, tombol), cyan `#008CD7` (aksen; kontras ke putih 3,7:1, jangan
untuk teks kecil). Warna status presensi tidak berubah.

Membuat ulang: `python sumber/trace.py sumber-logo-klien.png sumber/traced.json` lalu
`python sumber/build.py .` (butuh `opencv-python-headless`, `numpy`). PNG diekspor dari SVG lewat
browser headless.
