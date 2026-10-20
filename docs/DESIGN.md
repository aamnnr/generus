# DESIGN — Sistem Desain UI/UX Generus

> Versi 0.2 · 2026-10-20 · **Disetujui & diterapkan** · Pelengkap [PRD.md](PRD.md), [ARCHITECTURE.md](ARCHITECTURE.md)
> Referensi visual: konsep aplikasi Islami bernuansa hijau tua & krem (kartu lembut, ikon dalam ubin, kartu "hero" gelap dengan siluet masjid). Referensi diadaptasi untuk aplikasi **kerja** (presensi, data, laporan), bukan aplikasi ibadah pribadi.

---

## 1. Prinsip

| Prinsip | Artinya di Generus |
|---------|--------------------|
| **Teduh & bermartabat** | Hijau tua + krem, banyak ruang kosong, ornamen tipis. Tidak ramai, tidak "kekanak-kanakan". |
| **Cepat dipakai di lapangan** | Tugas utama (isi presensi, scan) ≤ 2 ketukan dari beranda. Target sentuh ≥ 44 px. Bisa dipakai satu tangan. |
| **Jelas di bawah tekanan** | Status selalu ditampilkan dengan **teks/huruf + warna** (H/T/I/S/A), tidak hanya warna. Umpan balik scan besar & langsung. |
| **Satu aplikasi, dua layar** | Mobile = bottom tab + kartu bertumpuk. Desktop = sidebar + tabel & kolom. Isi dan istilah sama. |
| **Hormat pada data anak** | Tanpa foto generus, avatar berupa inisial; data pribadi tidak tampil di layar publik/cetak kecuali nama & kelompok. |
| **Bahasa Indonesia yang ramah** | Salam "Assalamu'alaikum", kalimat pendek, tanpa jargon teknis (lihat §11). |

### Yang diambil dari referensi
- Palet hijau tua + krem, kartu putih ber-radius besar dengan bayangan sangat lembut.
- **Kartu hero** gelap (di referensi: "Next Prayer") → di Generus: **Agenda berikutnya / sedang berlangsung**.
- **Ubin aksi cepat** dengan ikon di kotak berwarna pasir → Scan QR, Presensi, Generus, Kartu QR.
- **Kartu progres** dengan bilah tipis → Kehadiran bulan ini / capaian target.
- Daftar dengan chevron, kolom cari berbentuk pil, chip filter.
- Bottom tab 4 item, judul serif untuk sapaan & angka besar, siluet masjid tipis sebagai watermark.

### Yang tidak diambil
- Foto masjid layar penuh (berat, tidak relevan untuk alat kerja). Halaman login cukup ilustrasi siluet ringan.
- Kompas kiblat, jadwal salat, dsb. (bukan lingkup produk).
- Avatar foto orang.

---

## 2. Warna

### 2.1 Palet dasar

| Token palet | Hex | OKLCH | Pemakaian |
|---|---|---|---|
| `green-950` | `#0E2A20` | `oklch(0.260 0.039 167.3)` | Teks di atas krem pada hero terang, sidebar gelap |
| `green-900` | `#133A2C` | `oklch(0.316 0.051 166.5)` | Gradien hero (ujung gelap) |
| `green-800` | `#1A4A39` | `oklch(0.371 0.060 166.8)` | **Kartu hero**, tombol utama saat ditekan |
| `green-700` | `#215943` | `oklch(0.420 0.070 164.4)` | **Primary**: tombol, tab aktif, tautan |
| `green-600` | `#2D6E54` | `oklch(0.488 0.079 164.3)` | Hover primary, bilah progres |
| `green-500` | `#4B8A6E` | `oklch(0.583 0.079 163.5)` | Grafik, aksen sekunder |
| `green-200` | `#C9DDD1` | `oklch(0.879 0.027 159.5)` | Garis fokus lembut, track progres |
| `green-100` | `#E2EDE6` | `oklch(0.936 0.015 158.2)` | Latar kartu kutipan/info, item terpilih |
| `green-50` | `#EFF5F1` | `oklch(0.965 0.008 157.1)` | Hover baris tabel |
| `cream-50` | `#FBFAF6` | `oklch(0.985 0.005 95.1)` | Permukaan kartu (alternatif putih) |
| `cream-100` | `#F6F3EC` | `oklch(0.965 0.010 87.5)` | **Latar aplikasi** |
| `cream-200` | `#EEE9DE` | `oklch(0.935 0.016 86.4)` | Ubin ikon, chip non-aktif, input |
| `cream-300` | `#E3DDCF` | `oklch(0.898 0.020 87.5)` | Garis/border |
| `ink-900` | `#1C2620` | `oklch(0.257 0.018 158.5)` | **Teks utama** |
| `ink-600` | `#56605A` | `oklch(0.478 0.016 159.5)` | **Teks redup** (keterangan, label) |
| `brass-500` | `#B08A4E` | `oklch(0.657 0.091 77.5)` | Ornamen, ikon dekoratif, garis aksen — **bukan untuk teks** |
| `brass-700` | `#8A6A35` | `oklch(0.545 0.081 78.3)` | Teks aksen kecil (mis. label "Mingguan") |
| `brass-100` | `#F3EAD9` | `oklch(0.940 0.025 83.4)` | Latar badge aksen |

### 2.2 Warna status presensi

Selalu dipasangkan dengan huruf (H/T/I/S/A) atau label. Teks putih di atas warna ini lolos AA (≥ 4,5).

| Status | Hex | OKLCH | Kontras teks putih | Latar lembut (badge) |
|---|---|---|---|---|
| Hadir | `#2F7A4F` | `oklch(0.521 0.101 155.2)` | 5,23 | `#E3F0E8` |
| Terlambat | `#9C620F` | `oklch(0.547 0.115 68.1)` | 5,04 | `#F6EBD8` |
| Izin | `#356C8C` | `oklch(0.508 0.077 236.6)` | 5,71 | `#E2ECF2` |
| Sakit | `#76558A` | `oklch(0.505 0.090 312.0)` | 6,11 | `#EEE6F2` |
| Alpa | `#B2392F` | `oklch(0.520 0.159 28.5)` | 5,97 | `#F6E2DF` |

Warna umpan balik pemindai: **berhasil** = Hadir, **sudah tercatat** = Terlambat (kuning), **ditolak** = Alpa.

### 2.3 Token semantik (dipakai komponen)

| Token | Terang | Gelap |
|---|---|---|
| `--background` | cream-100 | `#0F1713` |
| `--foreground` | ink-900 | `#ECEFE9` |
| `--card` | `#FFFFFF` | `#17221C` |
| `--muted` | cream-200 | `#202D26` |
| `--muted-foreground` | ink-600 | `#A3ADA6` |
| `--primary` | green-700 | `#7FC09E` |
| `--primary-foreground` | `#FFFFFF` | `#0F1713` |
| `--secondary` | green-100 | `#202D26` |
| `--secondary-foreground` | green-800 | `#ECEFE9` |
| `--accent` | brass-100 | `#2B3A32` |
| `--accent-foreground` | brass-700 | `#E8D3AE` |
| `--border` / `--input` | cream-300 | `#2B3A32` |
| `--ring` | green-600 | `#7FC09E` |
| `--destructive` | Alpa | `#E07A70` |
| `--hero` / `--hero-foreground` | green-800 / `#FFFFFF` | `#1A4A39` / `#FFFFFF` |

**Kontras terverifikasi (WCAG):** teks utama di latar 14,1 : 1 · teks redup di latar 5,9 : 1 · putih di primary 8,2 : 1 · putih di hero 10,1 : 1 · teks gelap mode gelap 15,7 : 1. Kuningan (`brass-500`) hanya 3,2 : 1 → **hanya dekorasi**.

### 2.4 Aturan pemakaian
- Maksimal **satu** kartu hero hijau tua per layar.
- Hijau untuk aksi & status positif; merah hanya untuk alpa, error, dan aksi menghapus.
- Grafik: urutan seri `green-700`, `brass-500`, `izin`, `sakit`, `green-500`.
- Mode gelap mengikuti pengaturan perangkat; tidak wajib di v1 tapi token sudah disiapkan.

---

## 3. Tipografi

| Peran | Font | Catatan |
|---|---|---|
| Teks & UI | **Plus Jakarta Sans** (Google Fonts, variabel 400–700) | Dibuat desainer Indonesia, jelas di layar kecil, angka tabular tersedia. |
| Judul display | **Lora** (600) | Serif lembut seperti "Noor/Dhuhr" di referensi. **Hanya** untuk sapaan beranda, angka besar di hero/statistik, judul halaman login & kartu cetak. |
| Teks Arab (materi, doa, kitab — Fase 4) | **Amiri** (400/700) | `dir="rtl"`, `lang="ar"`, ukuran ≥ 1,25× teks latin di sebelahnya. |
| Kode / token | Geist Mono | Kode kartu, ID teknis (jarang). |

### Skala (mobile → desktop)

| Token | Ukuran / tinggi baris | Font | Contoh |
|---|---|---|---|
| `display` | 28/34 → 32/40, 600 | Lora | "Assalamu'alaikum, Ayesha" |
| `stat` | 30/36 → 36/44, 600, tabular | Lora | `02:34:17`, `87%` |
| `h1` | 22/28 → 24/32, 700 | Jakarta | Judul halaman |
| `h2` | 18/26, 700 | Jakarta | Judul kartu/seksi |
| `body` | 15/22 → 16/24, 400 | Jakarta | Isi |
| `body-strong` | 15/22, 600 | Jakarta | Nama di daftar |
| `caption` | 13/18, 500 | Jakarta | Keterangan, meta |
| `overline` | 11/16, 600, huruf besar, spasi 0,06em | Jakarta | "AGENDA BERIKUTNYA" |

- Input dan isi form **minimal 16 px** (mencegah zoom otomatis iOS).
- Angka di tabel, jam, dan statistik pakai `tabular-nums`.
- Panjang baris teks ≤ 70 karakter (`max-w-prose`).

---

## 4. Bentuk, ruang, bayangan

| Token | Nilai | Pemakaian |
|---|---|---|
| `--radius` (dasar) | 12 px | Input, tombol |
| `radius-lg` | 16 px | Kartu biasa, ubin |
| `radius-xl` | 20 px | Kartu hero, sheet bawah |
| `radius-full` | 9999 px | Kolom cari, chip, badge, avatar |
| Spasi | skala 4 px: 4, 8, 12, 16, 20, 24, 32, 40, 48 | Padding kartu 16 (mobile) / 20–24 (desktop); jarak antarkartu 12–16 |
| Gutter halaman | 16 px mobile, 24 px tablet, 32 px desktop | |
| Bayangan kartu | `0 1px 2px oklch(0.26 0.04 167 / 0.06), 0 4px 16px oklch(0.26 0.04 167 / 0.06)` | Sangat lembut, bernuansa hijau |
| Bayangan mengambang | `0 8px 32px oklch(0.26 0.04 167 / 0.12)` | Bottom tab, sheet, tombol scan mengambang |
| Border | 1 px `--border` | Dipakai **atau** bayangan, jangan dua-duanya tebal |

---

## 5. Ikon & ornamen

- **Ikon:** Lucide (sudah terpasang), garis 1,75 px, 20 px di daftar, 24 px di ubin & tab.
- **Ubin ikon:** kotak 48 px (mobile) / 44 px (desktop), radius 14 px, latar `cream-200`, ikon `green-700`. Varian aktif: latar `green-100`.
- **Ornamen:** siluet masjid/kubah garis tipis (SVG inline, `brass-500` atau putih 8–12 % opasitas) di sudut kartu hero, halaman login, dan *empty state*. Pola geometri Islami (bintang 8) boleh sebagai tekstur 4–6 % opasitas. Selalu `aria-hidden`.
- **Avatar:** lingkaran inisial (2 huruf) latar `green-100`, teks `green-800`. Tidak ada foto.
- **Logo** (`src/components/brand/logo.tsx`): bintang delapan (*rub el hizb*) bergaris `brass-500`, di depannya masjid berkubah bawang dengan pintu mihrab terbuka (`green-800`, atau `cream` di atas latar hijau). Pintu selalu tembus ke latar; ada celah antara garis bintang dan masjid.
  - **Varian lengkap** (bulan sabit di puncak kubah): halaman login, kop/judul besar.
  - **Varian ikon** (tanpa sabit, garis lebih tebal): ikon PWA & favicon (di kotak `green-800`), tanda di sidebar, kartu ID. Tetap terbaca sampai 16–24 px dan saat dicetak satu warna.
  - Jangan menambah bayangan/gradien; warna hanya dari palet ini.

---

## 6. Layout & responsif

### 6.1 Breakpoint (Tailwind)

| Nama | Lebar | Navigasi | Konten |
|---|---|---|---|
| **Mobile** | < 768 px (`base`) | Top bar ringkas + **bottom tab** | 1 kolom, kartu bertumpuk, daftar sebagai kartu |
| **Tablet** | 768–1023 px (`md`) | Bottom tab (atau rail ikon bila landscape) | 2 kolom untuk kartu ringkasan; daftar mulai tabel ringkas |
| **Desktop** | ≥ 1024 px (`lg`) | **Sidebar kiri 256 px** + top bar | Grid 12 kolom, konten maks 1200 px; tabel penuh; panel detail berdampingan |
| **Lebar** | ≥ 1440 px (`2xl`) | Sidebar | Konten tetap maks 1200 px, rata tengah |

### 6.2 Kerangka

```
MOBILE (< 768)                         DESKTOP (≥ 1024)
┌────────────────────────┐             ┌──────────┬──────────────────────────────────┐
│ Top bar: judul / salam │             │ GENERUS  │ Top bar: judul · cari · avatar   │
│          🔔  (AK)      │             │          ├──────────────────────────────────┤
├────────────────────────┤             │ ⌂ Beranda│                                  │
│                        │             │ ▤ Agenda │   Konten (maks 1200 px)          │
│  Konten 1 kolom        │             │ ◎ Scan   │   grid 12 kolom, gutter 24–32    │
│  padding 16            │             │ ☰ Generus│                                  │
│                        │             │ ▦ Laporan│                                  │
│                        │             │ ──────── │                                  │
├────────────────────────┤             │ Wilayah  │                                  │
│ ⌂    ▤    ☰    ⋯       │ ← tab bawah │ Akun     │                                  │
└────────────────────────┘   + safe    └──────────┴──────────────────────────────────┘
                               area
```

### 6.3 Navigasi per peran

| Tab (mobile) / item (desktop) | Peran yang melihat |
|---|---|
| Beranda | Semua |
| Agenda | Admin, Kyai |
| Generus | Admin, Kyai |
| Lainnya (mobile) → Kartu QR, Kurikulum, Wilayah, Akun, Ganti password, Keluar | Sesuai peran |
| Kurikulum (Fase 4) | Tim Kurikulum, Admin, Kyai |
| Laporan (Fase 5) | Admin, Kyai, Kurikulum (agregat) |

- Bottom tab: 4 item, ikon + label (11–12 px), item aktif = ikon terisi + teks `green-700` + indikator garis 3 px di atas. Tinggi 64 px + `env(safe-area-inset-bottom)`.
- Petugas scan tanpa peran: beranda saja, kartu "Tugas scan" jadi hero.
- **Tombol Scan** di mobile: tombol bulat mengambang 56 px (`green-700`) di kanan bawah halaman Agenda yang sedang berlangsung, bukan tab permanen.

### 6.4 Pola konten mobile ↔ desktop

| Pola | Mobile | Desktop |
|---|---|---|
| Daftar data (generus, akun, agenda) | **Kartu daftar**: nama tebal + 1 baris meta + chevron; tindakan sekunder di menu ⋯ | **Tabel** dengan kolom lengkap, header lengket, baris hover `green-50` |
| Filter | Chip horizontal yang bisa digeser + tombol "Filter" membuka **bottom sheet** | Baris filter di atas tabel |
| Detail | Halaman penuh, seksi bertumpuk | Dua kolom: utama (2/3) + samping (1/3) |
| Form | Satu kolom, tombol utama penuh lebar & lengket di bawah | Dua kolom untuk field pendek, tombol di kanan bawah |
| Dialog konfirmasi | **Bottom sheet** | Dialog tengah |
| Checklist presensi | Satu baris per orang, tombol H/T/I/S/A 40 px | Sama, plus kolom kelompok & waktu tercatat |
| Pemindai | Kamera penuh lebar (rasio 1:1), panel hasil di atas | Kamera 480 px di kiri, daftar scan terakhir & penghitung di kanan |

---

## 7. Komponen

Dibangun di atas shadcn/ui (preset base-nova) dengan token di §2–§4. Nama dalam kurung = komponen yang sudah ada.

### 7.1 Sapaan (header beranda)
- Overline "ASSALAMU'ALAIKUM," (caption, redup) + nama (display, Lora) + emoji/ikon daun kecil `green-500` opsional.
- Kanan: lonceng notifikasi (Fase 5) + avatar inisial.
- Di bawahnya chip peran: "Admin Kelompok · Sukamaju 1".

### 7.2 Kartu hero — "Agenda berikutnya"
Padanan kartu "Next Prayer" di referensi.
```
┌───────────────────────────────────────┐  latar: gradien green-800 → green-900
│ AGENDA BERIKUTNYA            🕌 (siluet)│  radius 20, padding 20, teks putih
│ Pengajian Desa Sukamaju               │  overline 11 px putih 70 %
│ 02:34:17          19.30 WIB           │  stat Lora 30 px | jam kanan
│ [ Buka presensi → ]  [ Scan QR ]      │  tombol pil putih teks green-800 + tombol garis putih
└───────────────────────────────────────┘
```
- Saat agenda **berlangsung**: overline "SEDANG BERLANGSUNG", angka = jumlah tercatat `142 / 528`, bilah progres putih 30 %.
- Tidak ada agenda: hero menjadi ajakan "Buat agenda" (admin) atau disembunyikan.

### 7.3 Ubin aksi cepat
Grid 4 kolom (mobile) / baris 4–6 (desktop): **Scan QR**, **Presensi**, **Generus**, **Kartu QR** (admin); kyai: **Agenda**, **Generus**, **Laporan**. Ubin = ikon dalam kotak `cream-200` + label caption di bawah.

### 7.4 Kartu progres ("Today's Progress")
Judul seksi + tautan "Lihat semua" kanan. Item: ubin ikon kiri, judul + meta ("Kehadiran Oktober · 87 %"), bilah progres 6 px (`green-600` di atas `green-200`), chevron.

### 7.5 Kartu kutipan / info
Latar `green-100`, ornamen bintang 8 kecil di kiri, teks miring tengah, sumber caption. Dipakai untuk: motivasi (ayat/hadits pilihan admin, opsional), info penting ("Kartu QR wajib dibawa pada pengajian desa").

### 7.6 Daftar & item daftar
Item 64–72 px: (avatar/ubin) · nama `body-strong` + meta caption · badge status opsional · chevron `ink-600`. Pemisah garis 1 px atau jarak 8 px antarkartu (pilih satu per layar).

### 7.7 Kolom cari & chip filter
- Cari: pil penuh, latar `card`, ikon kaca pembesar kiri, tinggi 44 px.
- Chip: pil 32 px; aktif = latar `green-700` teks putih (seperti "All" di referensi); non-aktif = `cream-200` teks `ink-900`. Bisa digeser horizontal di mobile.

### 7.8 Tombol
| Varian | Gaya | Pakai untuk |
|---|---|---|
| Utama | `green-700`, teks putih, radius 12 (mobile CTA: pil 52 px, penuh lebar) | 1 per layar: "Simpan", "Mulai scan" |
| Sekunder | Garis `border`, latar `card` | Tindakan pendamping |
| Hantu | Teks `green-700` | Tautan tindakan, "Lihat semua" |
| Bahaya | Teks/latar Alpa | Hapus, batalkan |
Tinggi minimal 44 px di mobile. Ikon di kanan untuk navigasi ("→"), kiri untuk aksi.

### 7.9 Badge status
Pil 24 px, latar lembut status (§2.2) + teks warna status + huruf/label. Contoh: `● Hadir`, `Terkunci`, `Password sementara`.

### 7.10 Checklist presensi (`AttendanceChecklist`)
- Baris: nama + (L/P) + titik status antrian (kuning = menunggu kirim, merah = ditolak).
- Tombol H/T/I/S/A: kotak 40 px (mobile) / 32 px (desktop), radius 10; aktif = warna status penuh + huruf putih; tidak aktif = garis + huruf `ink-600`.
- Bilah status kirim lengket di bawah: titik hijau/kuning/biru + teks.

### 7.11 Pemindai (`/pindai`)
- Panel hasil 120 px di atas kamera: hijau (nama besar Lora 24 px + kelompok + status), kuning (sudah tercatat), merah (ditolak). Disertai bunyi & getar.
- Bingkai bidik putih radius 16 di tengah kamera, sudut-sudut tebal (gaya pemindai umum).
- Penghitung "Tercatat 142 / 528" pakai `stat`.

### 7.12 Bottom sheet & dialog
Sheet: radius atas 20, pegangan 36×4 px, latar `card`, bayangan mengambang. Maks 85 % tinggi layar.

### 7.13 Empty state
Ilustrasi garis siluet masjid 96 px `brass-500` 40 %, judul `h2`, satu kalimat, satu tombol. Contoh: "Belum ada agenda pekan ini".

### 7.14 Toast / notifikasi
Atas-tengah di mobile, kanan-bawah di desktop. Hijau untuk sukses, merah untuk gagal, netral untuk info. Hilang 4 detik; yang berisi aksi (mis. "Urungkan") 8 detik.

### 7.15 Banner offline (`Pwa`)
Strip `brass-100` + teks `brass-700` + ikon awan tercoret, lengket di atas. Lebih lembut dari kuning sekarang.

---

## 8. Blueprint layar utama

### 8.1 Beranda
```
MOBILE                                  DESKTOP (konten)
Sapaan + avatar                         ┌ Sapaan ───────────────────────┬ Avatar ┐
Chip peran                              ├───────────────────┬───────────────────┤
[Kartu hero: agenda berikutnya]          │ Hero (8 kolom)    │ Progres (4 kolom) │
Ubin aksi cepat ×4                      ├───────────────────┴───────────────────┤
"Ringkasan" → kartu progres ×2-3        │ Ubin aksi cepat (6)                   │
Kartu info/kutipan                      ├───────────────┬───────────────────────┤
(Tugas scan bila petugas)               │ Statistik ×3   │ Agenda pekan ini      │
                                        └───────────────┴───────────────────────┘
```

### 8.2 Agenda → Presensi
Mobile: judul + meta (tanggal, jam, lokasi) → chip ringkasan (H 120 · I 5 · …) → tombol "Scan QR" utama → kolom cari → checklist → bilah status kirim. Desktop: kiri checklist (8 kolom), kanan ringkasan per kelompok + kelola agenda + petugas scan (4 kolom).

### 8.3 Daftar generus
Mobile: cari pil + chip (Semua, Pra Remaja, Pelajar, Mandiri) + tombol filter (sheet: wilayah, status) → kartu daftar. Tombol tambah mengambang. Desktop: baris filter + tabel (Nama, L/P, Usia, Jenjang, Kelompok, Status) + tombol di header (Tambah, Import, Kartu QR, Kenaikan).

### 8.4 Pemindai
Mobile: header ringkas (← judul agenda) → panel hasil → kamera 1:1 → kolom kode & cari nama → penghitung → scan terakhir. Desktop: dua kolom (kamera & input | hasil, penghitung, riwayat).

### 8.5 Login
Mobile: latar krem dengan ilustrasi siluet masjid di sepertiga atas (SVG ringan, bukan foto), logo + nama "Generus" (Lora), tagline "Presensi · Materi · Kitab", form di kartu bawah. Desktop: dua panel — kiri hero hijau tua dengan ilustrasi & tagline, kanan form.

### 8.6 Kartu QR (cetak)
Tetap 85,6 × 54 mm. Strip kiri `green-800` 6 mm dengan siluet kubah putih, nama Lora, logo kecil. Cetak hitam-putih harus tetap terbaca (QR selalu hitam di atas putih).

---

## 9. Gerak & interaksi
- Durasi 150–200 ms, `ease-out`; sheet 250 ms.
- Tekan: skala 0,98 + bayangan berkurang. Hover desktop: latar `green-50`.
- Hasil scan: kilas warna 300 ms + bunyi + getar.
- Skeleton (bukan spinner) untuk konten yang dimuat > 300 ms; sesuaikan dengan bentuk kartu.
- Hormati `prefers-reduced-motion`: matikan animasi non-esensial.
- **Penerapan** (`globals.css` bagian "Gerak", `(app)/layout.tsx`):
  - Perpindahan halaman: link dalam aplikasi memakai `@/components/app-link` (bukan `next/link`) yang menandai navigasi `page`; konten utama crossfade bersamaan ±220 ms (konten baru naik 6 px), tanpa jeda kosong. Sidebar & tab bawah diam. Aksi/simpan form tidak memicu crossfade.
  - Ganti kategori/tab/filter/halaman daftar di halaman yang sama: tandai `transitionTypes={[TAB_TRANSITION]}` (sudah otomatis di `SegmentNav`, `QueryForm`, `QuerySelect`) + `scroll={false}`. Memakai crossfade bawaan browser 180 ms, sehingga judul/tab/filter yang sama tetap diam dan hanya data yang berubah memudar.
  - Tab segmen (`SegmentNav`): pil aktif meluncur ke tab baru.
  - Konten yang selesai dimuat & elemen baru di halaman: fade 220 ms. Pemuatan memakai kerangka (`PageLoading`), bukan teks.
  - Panel yang dibuka (filter, pengaturan, konfirmasi, form ubah): kelas `animate-enter` (fade + naik 6 px, 200 ms).
  - Hover/tekan pada link & tombol: transisi warna 150 ms.
- **Area klik:** baris daftar/tabel yang membuka detail bisa diklik di seluruh baris (link dengan `after:absolute after:inset-0` di baris `relative`), bukan hanya di kolom nama.

---

## 10. Aksesibilitas
- Kontras minimal AA (lihat §2.3); fokus terlihat: cincin 3 px `--ring` + jarak 2 px.
- Target sentuh ≥ 44 × 44 px; jarak antartarget ≥ 8 px.
- Status tidak hanya warna (huruf/ikon/teks).
- Semua ikon tanpa label diberi `aria-label`; ornamen `aria-hidden`.
- Teks Arab: `lang="ar" dir="rtl"`; transliterasi & arti di bawahnya.
- Dukung zoom teks 200 % tanpa tata letak rusak; jangan kunci orientasi selain pemindai.

---

## 11. Nada & teks
- Sapaan: "Assalamu'alaikum, {nama}". Penutup aksi sukses singkat: "Presensi tersimpan."
- Kata kerja di tombol: "Simpan", "Buka presensi", "Mulai scan" — bukan "OK/Submit".
- Error: sebab + langkah: "Kelompok tidak ditemukan. Tulis 'Desa / Kelompok' seperti di daftar."
- Istilah konsisten: generus, kelompok, desa, daerah, pengajian/agenda, presensi, alpa, izin, sakit, terlambat, kartu QR, petugas scan.
- Angka & tanggal format Indonesia: `20 Okt 2026`, `19.30 WIB`, `1.234`.

---

## 12. Implementasi

### 12.1 Font (`src/app/layout.tsx`)
```ts
import { Amiri, Lora, Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
const sans = Plus_Jakarta_Sans({ variable: "--font-sans", subsets: ["latin"] });
const display = Lora({ variable: "--font-display", subsets: ["latin"], weight: ["600"] });
const arabic = Amiri({ variable: "--font-arabic", subsets: ["arabic"], weight: ["400", "700"] });
```
Tambahkan di `@theme inline`: `--font-heading: var(--font-display); --font-arabic: var(--font-arabic);` → kelas `font-heading`, `font-arabic`.

### 12.2 Token (`src/app/globals.css`)
```css
:root {
  --radius: 0.75rem;
  --background: oklch(0.965 0.010 87.5);      /* cream-100 */
  --foreground: oklch(0.257 0.018 158.5);     /* ink-900 */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.257 0.018 158.5);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.257 0.018 158.5);
  --primary: oklch(0.420 0.070 164.4);        /* green-700 */
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.936 0.015 158.2);      /* green-100 */
  --secondary-foreground: oklch(0.371 0.060 166.8);
  --muted: oklch(0.935 0.016 86.4);           /* cream-200 */
  --muted-foreground: oklch(0.478 0.016 159.5);/* ink-600 */
  --accent: oklch(0.940 0.025 83.4);          /* brass-100 */
  --accent-foreground: oklch(0.545 0.081 78.3);/* brass-700 */
  --destructive: oklch(0.520 0.159 28.5);     /* alpa */
  --border: oklch(0.898 0.020 87.5);          /* cream-300 */
  --input: oklch(0.898 0.020 87.5);
  --ring: oklch(0.488 0.079 164.3);           /* green-600 */
  --hero: oklch(0.371 0.060 166.8);           /* green-800 */
  --hero-foreground: oklch(1 0 0);
  --status-hadir: oklch(0.521 0.101 155.2);
  --status-terlambat: oklch(0.547 0.115 68.1);
  --status-izin: oklch(0.508 0.077 236.6);
  --status-sakit: oklch(0.505 0.090 312.0);
  --status-alpa: oklch(0.520 0.159 28.5);
  --chart-1: oklch(0.420 0.070 164.4);
  --chart-2: oklch(0.657 0.091 77.5);
  --chart-3: oklch(0.508 0.077 236.6);
  --chart-4: oklch(0.505 0.090 312.0);
  --chart-5: oklch(0.583 0.079 163.5);
}
.dark {
  --background: oklch(0.195 0.014 163.0);
  --foreground: oklch(0.948 0.009 128.6);
  --card: oklch(0.239 0.019 160.6);
  --card-foreground: oklch(0.948 0.009 128.6);
  --popover: oklch(0.239 0.019 160.6);
  --popover-foreground: oklch(0.948 0.009 128.6);
  --primary: oklch(0.754 0.083 160.7);
  --primary-foreground: oklch(0.195 0.014 163.0);
  --secondary: oklch(0.283 0.022 161.1);
  --secondary-foreground: oklch(0.948 0.009 128.6);
  --muted: oklch(0.283 0.022 161.1);
  --muted-foreground: oklch(0.738 0.015 155.5);
  --accent: oklch(0.332 0.024 161.4);
  --accent-foreground: oklch(0.86 0.06 80);
  --border: oklch(0.332 0.024 161.4);
  --input: oklch(0.332 0.024 161.4);
  --ring: oklch(0.754 0.083 160.7);
  --hero: oklch(0.371 0.060 166.8);
}
```
Daftarkan `--color-hero`, `--color-hero-foreground`, `--color-status-*` di `@theme inline` agar bisa dipakai sebagai `bg-hero`, `text-status-hadir`, dst. Warna status di checklist & pemindai (saat ini kelas Tailwind bawaan emerald/amber/sky/violet/red) diganti token ini.

### 12.3 Komponen baru yang dibutuhkan
`AppShell` (sidebar desktop + bottom tab mobile + top bar), `HeroCard`, `QuickActionTile`, `ProgressItem`, `ListItem`, `SearchPill`, `FilterChips`, `StatusBadge`, `EmptyState`, `Ornament` (SVG siluet & bintang 8), `BottomSheet` (atau `Drawer` shadcn), `Fab`.

### 12.4 Urutan penerapan
1. Token + font + `--radius` → seluruh aplikasi langsung berganti warna.
2. `AppShell`: bottom tab mobile, sidebar desktop (gantikan header saat ini).
3. Beranda baru (hero agenda, ubin, progres).
4. Daftar generus & akun: kartu di mobile, tabel di desktop.
5. Agenda/presensi & pemindai: warna status, tata letak dua kolom desktop.
6. Login, empty state, ikon PWA, kartu QR cetak.
7. Audit: Lighthouse aksesibilitas ≥ 95, cek 360 px, 768 px, 1280 px; mode gelap.

### 12.4b Status penerapan (2026-10-20)
- [x] Token, radius, font (Plus Jakarta Sans, Lora, Amiri); komponen dasar (kartu, tombol 44 px, input) disesuaikan.
- [x] AppShell: `src/components/shell/` — menu samping ≥ 1024 px, tab bawah < 1024 px, halaman `/lainnya`.
- [x] Beranda: hero agenda berlangsung/berikutnya, ubin aksi, ringkasan bulan, statistik.
- [x] Generus: kartu di HP, tabel di desktop, chip jenjang, filter bisa dilipat, tombol tambah mengambang.
- [x] Agenda/presensi & pemindai: token warna status, kotak statistik berwarna, checklist selebar layar di HP.
- [x] Login dua panel, ikon PWA kubah, halaman offline, kartu QR cetak.
- [x] Halaman lain (wilayah, akun, form tambah/ubah, import, kenaikan, kartu) dirapikan: `PageHeader`, `BackLink`, `EmptyState`, `Pill` di `src/components/page-header.tsx`; daftar akun kartu (HP) + tabel (desktop); pilihan sasaran agenda berupa chip.
- [ ] Mode gelap: token siap, belum diaktifkan di UI.

Mockup rujukan: kanvas "Mockup UI Generus" (artifact).

### 12.5 Checklist review desain (setiap PR UI)
- [ ] Dicek di lebar 360, 768, 1280 px; tidak ada gulir horizontal.
- [ ] Satu tombol utama per layar; target sentuh ≥ 44 px.
- [ ] Status pakai teks/huruf, bukan warna saja.
- [ ] Teks redup memakai `muted-foreground`, bukan abu-abu acak.
- [ ] Kosong, memuat, error, offline sudah dirancang.
- [ ] Tidak ada foto/data pribadi yang tidak perlu.
