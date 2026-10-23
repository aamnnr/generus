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
| PWA | Fase 1: `public/sw.js` manual (aset statis + halaman offline) & `experimental.useOffline`. Fase 2: Serwist bila perlu precache lebih luas | Sederhana dulu; data pribadi tidak disimpan di cache |
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
│  Service Worker (public/sw.js): aset statis, halaman offline           │
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

curriculum_periods (id, name, semester, starts_on, ends_on, published_at?)
                  -- mis. "Oktober 2026", "1-2026", 2026-10-05 … 2026-11-07
kitab            (id, title, unit[ayat|halaman|bab], total, sort)
                  -- "lintasan" progres: Bacaan Al-Qur'an & Makna Al-Qur'an (unit ayat,
                  --  total 6236, posisi = nomor ayat urut mushaf → ditampilkan surat:ayat),
                  --  Makna Hadist K. Janaiz (unit halaman), dst.
materi           (id, aspek[alim|faqih|akhlaq|mandiri], mapel, title, body?,
                  arabic?, translation?, source?, assessment[generus|kelompok], archived)
                  -- pustaka; dipakai ulang lintas periode (hafalan, dalil, doa)
period_targets   (id, period_id, jenjang_id, kategori_id?, gender?, sort,
                  aspek, mapel, materi_id? | (kitab_id, range_from, range_to),
                  strategy?, optional bool)
                  -- kategori_id/gender NULL = berlaku untuk semua
achievements     (target_id, generus_id, status[belum|proses|tuntas], note,
                  updated_by, updated_at, PK(target_id, generus_id))  -- assessment = generus
target_deliveries(target_id, kelompok_id, delivered_on, note, by,
                  PK(target_id, kelompok_id))                          -- assessment = kelompok
kitab_progress   (id, generus_id, kitab_id, position, recorded_on, recorded_by)
                  -- append-only; posisi terkini = view kitab_progress_latest;
                  -- capaian target kitab: tuntas bila posisi ≥ range_to, proses bila > posisi awal periode

audit_log        (id, actor_id, table, row_id, action, before jsonb, after jsonb, at)
```

### Hierarki & lingkup akses
- `units.path` memakai `ltree`, mis. `d01.ds03.k12`. "Unit X dan semua turunannya" = `path <@ X.path` — satu kondisi, ber-indeks GiST.
- Fungsi SQL `user_scope_paths(uid)` mengembalikan path unit yang dipegang user. Kebijakan RLS di setiap tabel data: baris boleh diakses jika unit pemiliknya berada di bawah salah satu path tersebut.
- Hak *tulis* lebih ketat dari *baca*: misalnya Admin Desa boleh **membaca** presensi agenda kelompok, tapi hanya **menulis** presensi agenda milik desanya; Admin Kelompok boleh menulis presensi agenda desa **hanya untuk generus kelompoknya** dan **sebelum `delegate_until`**.
- Peran **kyai** tidak memiliki kebijakan tulis sama sekali (read-only di level RLS). Peran **kurikulum** hanya boleh menulis tabel `curriculum_periods`, `materi`, `kitab`, `period_targets`, dan membaca agregat capaian. Periode yang belum diterbitkan hanya terlihat oleh kurikulum & superadmin. Rekap lintas unit memakai fungsi agregat SECURITY DEFINER `app.capaian_rekap_units` / `app.capaian_rekap_targets` (cek akses `app.can_read_rekap`): Tim Kurikulum mendapat angka agregat tanpa akses ke baris generus.
- Otorisasi dicek dua lapis: di server (pesan error ramah) dan di RLS (pengaman terakhir).

### Matriks akses ringkas

| Data | Superadmin | Kurikulum | Admin (unit) | Kyai (unit) |
|------|-----------|-----------|--------------|-------------|
| Pohon wilayah, akun | Tulis | – | Baca | Baca |
| Generus | Tulis | – | Tulis (kelompok); mutasi (desa/daerah) | Baca |
| Agenda & presensi | Tulis | – | Tulis agenda milik unitnya; delegasi untuk kelompok | Baca |
| Materi, kitab, target | Tulis | Tulis | Baca | Baca |
| Capaian, penyampaian & progres kitab | Tulis | Baca agregat | Tulis (generus/kelompok miliknya) | Baca |

### Status generus & cakupan
- Sasaran agenda dan target hanya menghitung generus `aktif` **pada tanggal agenda / dalam rentang periode target**. Karena `status_date` disimpan, laporan bulan lalu tetap memuat generus yang baru menikah/pindah sambung bulan ini.
- Saat status berubah ke `menikah`/`pindah_sambung`, `qr_token` dinonaktifkan (scan menampilkan "sudah tidak aktif").

### Peserta sasaran agenda
Tidak disimpan per baris; dihitung: generus `aktif` yang `kelompok.path <@ agenda.unit.path` dan sesuai filter jenjang/kategori/gender. Saat agenda dikunci, snapshot daftar sasaran disimpan agar laporan historis tidak berubah ketika generus pindah/naik jenjang.

## 4b. Autentikasi & Akses dari Aplikasi

- **Login**: Supabase Auth (email + password). Akun dibuat Superadmin dengan password sementara (`profiles.must_change_password`), yang wajib diganti saat login pertama. Tidak ada pendaftaran mandiri.
- **Sesi**: `src/proxy.ts` memperbarui cookie sesi di setiap request dan mengalihkan pengunjung tanpa sesi ke `/login`. Kode lain hanya **membaca** cookie (`createSupabaseServer()`), kecuali aksi login/logout/ganti password (`{ writeCookies: true }`). Menulis cookie di tengah Server Action biasa memicu `InvariantError` di Next 16.
- **Data Access Layer**: `src/lib/auth.ts`. `getSession()` memverifikasi JWT (`auth.getClaims()`), `getCurrentUser()` memuat profil + peran, `requireSuperadmin()` untuk halaman/aksi admin. Setiap Server Action memeriksa ulang sesinya sendiri.
- **Query atas nama user**: `withRls(claims, tx => …)` di `src/db/rls.ts` menjalankan transaksi dengan `SET LOCAL ROLE authenticated` + klaim JWT, sehingga kebijakan RLS berlaku sama seperti lewat PostgREST.
- **Operasi Auth admin** (buat akun, reset password, blokir) memakai service role key, hanya setelah `requireSuperadmin()`. Menonaktifkan akun = `profiles.active = false` (RLS) **dan** ban di Supabase Auth (tidak bisa login).
- **Cache Components**: semua bagian yang membaca sesi berada di dalam `<Suspense>`; `getSession()` memanggil `connection()` karena klien auth Supabase memakai `Date.now()`.

## 4b-2. Aplikasi Android (generus-mobile)

- Proyek terpisah `../generus-mobile` (Kotlin + Jetpack Compose), memakai **project Supabase yang sama**: Supabase Auth + PostgREST langsung, tanpa backend baru. RLS & trigger tetap pengaman utama.
- Query gabungan yang di PWA ada di `src/lib/*.ts` disediakan sebagai RPC `public.mobile_*` (SECURITY INVOKER) di `drizzle/0014_mobile_api.sql`; dites di `tests/db/mobile-api.test.ts`. Hasil yang bisa > 1.000 baris dikembalikan sebagai satu jsonb (batas baris PostgREST). **Mengubah logika query di `src/lib/*.ts` → periksa juga padanannya di migrasi ini.**
- Operasi Auth admin (buat akun, reset password, blokir) lewat Edge Function `supabase/functions/admin-akun` (memegang service role key; pemanggil dicek superadmin via `mobile_is_superadmin()`).
- Antrian presensi di Room + WorkManager (bisa terkirim walau aplikasi ditutup); scan memakai roster `token_hash` yang sama.

## 4c. Antrian presensi (Fase 2, sudah berjalan)

- `src/lib/offline/outbox.ts`: tabel `outbox` di IndexedDB (Dexie), kunci `agenda:generus` sehingga ketukan terakhir menimpa yang lama.
- Checklist menulis ke antrian lalu memanggil `requestSync()`; `src/components/outbox-sync.tsx` (dipasang di layout) mengirim antrian saat dimuat, saat `online`, saat diminta, dan tiap 20 detik bila masih ada antrian.
- Server melakukan upsert per (agenda, generus) → pengiriman ulang aman. Item hanya dihapus bila server membalas jelas (`saved`); item yang ditolak (RLS/batas waktu) ditandai dan bisa dicoba lagi atau dibuang.
- Scan QR di Fase 3 memakai antrian yang sama, ditambah unduhan roster (§5).

## 5. Alur Presensi Offline (scan QR)

> **Status (Fase 3, sudah dibangun):** roster berisi `token_hash` = SHA-256 dari isi QR `GNR1:<token>` (fungsi `app.agenda_roster`, hanya untuk pengelola & petugas scan), dicocokkan di perangkat. Halaman `/pindai` statis tanpa data pribadi sehingga di-cache service worker; data di IndexedDB (`roster`, `scanAgendas`, `outbox`). Scan dikirim dengan mode `scan`/`search` → `ON CONFLICT DO NOTHING` (catatan pertama menang). Detail di bawah adalah rancangan awal.

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
