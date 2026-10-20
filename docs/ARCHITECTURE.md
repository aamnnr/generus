# ARCHITECTURE — Sistem Pemantauan Ketertiban Generus

> Versi 0.3 · 2026-10-20 · Pelengkap [PRD.md](PRD.md) dan [PLAN.md](PLAN.md)

## 1. Keputusan Platform: PWA, bukan Kotlin native

| Kriteria | PWA | Kotlin native (Android) |
|----------|-----|-------------------------|
| Pengguna iPhone (kyai/admin) | ✅ Jalan | ❌ Perlu app iOS terpisah |
| Dashboard di laptop (admin, kurikulum) | ✅ Codebase sama | ❌ Tetap perlu web terpisah |
| Distribusi & update | ✅ Buka link, "Tambahkan ke layar utama"; update instan | ⚠️ Play Store / APK, update manual |
| Scan QR via kamera | ✅ `BarcodeDetector` + polyfill WASM | ✅ ML Kit, sedikit lebih cepat |
| Offline | ✅ Service worker + IndexedDB, cukup untuk presensi | ✅ Lebih kuat |
| NFC, background sync agresif | ⚠️ Terbatas (tidak di iOS) | ✅ |
| Biaya & tim | ✅ 1 codebase, 1 bahasa (TypeScript) | ❌ ≥ 2 codebase |

**Keputusan: PWA.** Sistem ini dominan dashboard, form, dan laporan multi-peran; kebutuhan "native" satu-satunya adalah scan QR + offline, dan keduanya sudah tercukupi di browser modern. Kotlin native baru layak jika kelak butuh NFC/RFID atau ada kendala nyata scan di HP kelas bawah — dan itu bisa ditambahkan sebagai **app scanner kecil** yang memakai API yang sama, tanpa menulis ulang sistem.

## 2. Stack

| Lapisan | Pilihan | Alasan |
|---------|---------|--------|
| Framework | **Next.js (App Router) + TypeScript** | Satu proyek untuk UI + API (Server Actions/Route Handlers), ekosistem besar |
| UI | Tailwind CSS + shadcn/ui | Cepat, konsisten, mobile-first |
| Database | **PostgreSQL** (Supabase managed) | Relasional, Row Level Security untuk hierarki wilayah, ekstensi `ltree` |
| ORM / migrasi | Drizzle ORM + drizzle-kit | Type-safe, SQL-dekat, migrasi berbasis file |
| Auth | Supabase Auth (email + password / magic link; opsional login WhatsApp OTP nanti) | Terintegrasi dengan RLS (`auth.uid()`) |
| PWA | Serwist (service worker untuk Next.js) | Precache app shell, offline fallback |
| Penyimpanan offline | Dexie (IndexedDB) | Antrian presensi & roster agenda |
| Scan QR | `barcode-detector` (polyfill zxing-wasm) | Native di Android Chrome, fallback WASM di iOS |
| Cetak kartu QR | `qrcode` + `@react-pdf/renderer` | PDF kartu massal |
| Grafik | Recharts | Dashboard |
| Ekspor | ExcelJS | Laporan bulanan |
| Validasi | Zod | Dipakai bersama klien & server |
| Hosting | Vercel (app) + Supabase (DB) — **atau** VPS + Docker (Coolify) bila ingin self-host | Mulai gratis/murah; bisa pindah |

## 3. Gambaran Komponen

```
┌───────────────────────────── PWA (Next.js) ─────────────────────────────┐
│  Dashboard & Laporan   Data Master   Agenda   Kurikulum   Presensi      │
│                                                    │                    │
│                                     ┌──────────────┴───────────────┐    │
│                                     │ Modul Scanner (offline-first) │    │
│                                     │  Dexie: roster + outbox       │    │
│                                     └──────────────┬───────────────┘    │
│  Service Worker (Serwist): app shell cache, offline fallback            │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS (Server Actions / Route Handlers)
┌───────────────────────────────┴─────────────────────────────────────────┐
│  Server (Next.js runtime)                                               │
│   • Otorisasi peran + lingkup unit   • Sync presensi (idempotent)       │
│   • Agregasi laporan                 • Job terjadwal (cron)             │
└───────────────────────────────┬─────────────────────────────────────────┘
┌───────────────────────────────┴─────────────────────────────────────────┐
│  PostgreSQL: data + RLS (lingkup unit) + materialized views laporan     │
└─────────────────────────────────────────────────────────────────────────┘
```

## 4. Model Data (inti)

```
units            (id, parent_id, level[daerah|desa|kelompok], name, path ltree)
users            (id, name, phone, email, active)
user_roles       (user_id, unit_id, role[superadmin|kurikulum|admin|kyai], ...)
                  -- kurikulum: hanya di unit level daerah; kyai: read-only
jenjang          (id, name, order)                    -- Pra Remaja, Remaja
jenjang_kategori (id, jenjang_id, name)               -- hanya Remaja: Pelajar, Mandiri
generus          (id, kelompok_id → units, name, gender, birth_date,
                  jenjang_id, kategori_id?, qr_token UNIQUE,  -- kategori_id wajib jika jenjang punya kategori
                  status[aktif|pindah_sambung|menikah],
                  status_date, status_note)
generus_mutations(id, generus_id, from_unit, to_unit, date, by)  -- pindah kelompok dalam daerah
generus_status_history(id, generus_id, from_status, to_status, date, note, by)

agendas          (id, unit_id, title, type, starts_at, late_after, ends_at,
                  location, target_jenjang[], target_gender, recurrence_id,
                  delegate_until, locked_at)
agenda_scanners  (agenda_id, user_id, expires_at)          -- petugas sementara
attendance       (id UUID dari klien, agenda_id, generus_id, status,
                  method[manual|scan|delegasi|search|self], recorded_by,
                  recorded_at, device_id, UNIQUE(agenda_id, generus_id))

materi           (id, jenjang_id, category, title, order)
kitab            (id, title, unit_type[bab|halaman], total)
monthly_targets  (id, daerah_id, jenjang_id, kategori_id?, year_month,
                  materi_id?, kitab_id?, kitab_from?, kitab_to?)
                  -- kategori_id NULL = berlaku untuk semua kategori di jenjang itu
achievements     (generus_id, target_id, status[belum|proses|tuntas],
                  updated_by, updated_at, note)
kitab_progress   (id, generus_id, kitab_id, position, recorded_at, recorded_by)
                  -- append-only; posisi terkini = baris terbaru per (generus, kitab)

audit_log        (id, actor_id, table, row_id, action, before jsonb, after jsonb, at)
```

### Hierarki & lingkup akses
- `units.path` memakai `ltree`, mis. `d01.ds03.k12`. "Unit X dan semua turunannya" = `path <@ X.path` — satu kondisi, ber-indeks GiST.
- Fungsi SQL `user_scope_paths(uid)` mengembalikan path unit yang dipegang user. Kebijakan RLS di setiap tabel data: baris boleh diakses jika unit pemiliknya berada di bawah salah satu path tersebut.
- Hak *tulis* lebih ketat dari *baca*: misalnya Admin Desa boleh **membaca** presensi agenda kelompok, tapi hanya **menulis** presensi agenda milik desanya; Admin Kelompok boleh menulis presensi agenda desa **hanya untuk generus kelompoknya** dan **sebelum `delegate_until`**.
- Peran **kyai** tidak memiliki kebijakan tulis sama sekali (read-only di level RLS). Peran **kurikulum** hanya boleh menulis tabel `materi`, `kitab`, `monthly_targets`, dan membaca agregat capaian.
- Otorisasi dicek dua lapis: di server (pesan error ramah) dan di RLS (pengaman terakhir).

### Matriks akses ringkas

| Data | Superadmin | Kurikulum | Admin (unit) | Kyai (unit) |
|------|-----------|-----------|--------------|-------------|
| Pohon wilayah, akun | Tulis | – | Baca | Baca |
| Generus | Tulis | – | Tulis (kelompok); mutasi (desa/daerah) | Baca |
| Agenda & presensi | Tulis | – | Tulis agenda milik unitnya; delegasi untuk kelompok | Baca |
| Materi, kitab, target | Tulis | Tulis | Baca | Baca |
| Capaian & progres kitab | Tulis | Baca agregat | Tulis (kelompok) | Baca |

### Status generus & cakupan
- Sasaran agenda dan target hanya menghitung generus `aktif` **pada tanggal agenda/bulan target**. Karena `status_date` disimpan, laporan bulan lalu tetap memuat generus yang baru menikah/pindah sambung bulan ini.
- Saat status berubah ke `menikah`/`pindah_sambung`, `qr_token` dinonaktifkan (scan menampilkan "sudah tidak aktif").

### Peserta sasaran agenda
Tidak disimpan per baris; dihitung: generus `aktif` yang `kelompok.path <@ agenda.unit.path` dan sesuai filter jenjang/kategori/gender. Saat agenda dikunci, snapshot daftar sasaran disimpan agar laporan historis tidak berubah ketika generus pindah/naik jenjang.

## 5. Alur Presensi Offline (scan QR)

1. **Persiapan (online)** — petugas membuka agenda → aplikasi mengunduh *roster*: `{qr_token → generus_id, nama, kelompok}` untuk sasaran agenda (5.000 generus ≈ < 500 KB) ke Dexie.
2. **Scan (boleh offline)** — kamera membaca `qr_token` → dicocokkan ke roster lokal → tampil nama + bunyi/getar → simpan ke `outbox` dengan `id` UUID buatan klien, `recorded_at` waktu perangkat, `device_id`.
   - Token tidak ada di roster → tampil "bukan peserta sasaran / tidak dikenal" (bisa tetap dicatat sebagai tamu jika diizinkan).
   - Sudah discan di perangkat ini → abaikan dengan indikator "sudah hadir".
3. **Sinkron** — saat online (dan setiap 10 detik selama halaman terbuka) outbox dikirim per batch. Server `INSERT ... ON CONFLICT (agenda_id, generus_id) DO NOTHING` → idempoten dan aman dari scan ganda di perangkat berbeda. Respons memuat daftar yang sudah tercatat sehingga semua perangkat petugas saling tahu.
4. **Penutupan** — setelah agenda selesai, generus sasaran tanpa catatan otomatis `alpa` saat agenda dikunci (job terjadwal di `delegate_until`).

Catatan iOS: Background Sync tidak tersedia, jadi sinkron dipicu saat aplikasi dibuka/aktif; UI menampilkan jumlah "belum tersinkron" dengan jelas.

### Keamanan QR
- `qr_token` = string acak 12+ karakter (bukan ID/nama) → kartu yang bocor tidak membuka data apa pun.
- Kartu bisa dicabut/diterbitkan ulang (token baru).
- Fase 2 self check-in memakai QR agenda bertanda tangan HMAC dengan masa berlaku 30 detik + akun generus.

## 6. Laporan

- Materialized view `mv_attendance_monthly(unit_path, year_month, jenjang, hadir, izin, sakit, alpa, total)` dan `mv_achievement_monthly(...)`, di-refresh tiap malam dan saat agenda dikunci.
- Dashboard tingkat atas membaca agregat, bukan baris mentah → cepat walau data bertambah.
- Drill-down cukup memfilter `unit_path`.

## 7. Struktur Proyek (usulan)

```
generus/
├─ app/
│  ├─ (auth)/login
│  ├─ (app)/dashboard
│  ├─ (app)/wilayah            # pohon unit (superadmin)
│  ├─ (app)/generus            # data generus, import, kartu QR
│  ├─ (app)/agenda/[id]/presensi
│  ├─ (app)/agenda/[id]/scan   # modul scanner offline
│  ├─ (app)/kurikulum          # materi, kitab, target bulanan
│  ├─ (app)/capaian
│  └─ (app)/laporan
├─ lib/
│  ├─ db/ (schema.ts, migrations/, rls.sql)
│  ├─ auth/ (session, scope)
│  ├─ offline/ (dexie.ts, outbox.ts, sync.ts)
│  └─ validation/
├─ components/
└─ tests/ (unit, e2e Playwright)
```

## 8. Operasional

- **Backup**: backup harian Supabase + ekspor mingguan ke penyimpanan terpisah.
- **Monitoring**: Sentry untuk error klien/server (penting untuk melihat gagal scan/sinkron di lapangan).
- **Lingkungan**: `dev` (project Supabase development; Docker/Supabase CLI opsional), `staging`, `production`.
- **Testing**: Vitest. Migrasi, trigger, dan RLS dites terhadap Postgres sungguhan via PGlite (`tests/db/`), tanpa Docker; e2e (Playwright) untuk alur scan offline dengan mode network offline.
