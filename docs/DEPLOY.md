# Deploy: Server Resmi & Server Uji

Penerapan bertahap memakai **satu kode, dua server**:

| | Server **RESMI** | Server **UJI** |
|---|---|---|
| Untuk | Pengurus (penerapan nyata) | Developer/pemilik sistem |
| Domain | `pantau-generus.vercel.app` | project Vercel kedua, mis. `generus-uji.vercel.app` |
| Supabase | project **baru**, data asli | project yang dipakai sejak development |
| Modul | **Tahap 1**: Database Generus & Presensi (+ laporan presensi) | Semua: + Kurikulum, Target Materi, Capaian |
| `FEATURE_KURIKULUM` | `off` | `on` (atau tidak diisi) |
| `APP_ENV` | `production` | `staging` |
| Data | wilayah Samber + generus asli; tanpa akun uji | data contoh, akun `*@generus.test`, `pnpm db:seed` boleh |

`FEATURE_KURIKULUM=off` menyembunyikan menu Kurikulum/Capaian/Rekap, kartu target di beranda,
kartu capaian di detail generus, kolom & peringatan capaian di Laporan dan ekspor Excel, serta
mengalihkan `/kurikulum/*` dan `/capaian/*` ke beranda. Tabel kurikulum tetap ada di database,
jadi Tahap 2 cukup mengubah saklar ini menjadi `on` lalu redeploy.

## A. Menyiapkan server uji (dulu, agar lingkungan Anda tetap jalan)

1. Vercel → **Add New → Project** → pilih repo yang sama → beri nama mis. `generus-uji`.
2. Environment Variables: salin semua nilai dari project yang sekarang (`DATABASE_URL` port 6543,
   kunci Supabase, `NEXT_PUBLIC_APP_TIMEZONE`), lalu `APP_ENV=staging`, `FEATURE_KURIKULUM=on`,
   `ENABLE_EXPERIMENTAL_COREPACK=1`. Deploy.
3. Supabase project uji → **Authentication → URL Configuration → Site URL** = domain uji.

## B. Menyiapkan server resmi

1. Supabase → **New project** (region Southeast Asia / Singapore), mis. `pantau-generus-resmi`.
2. Di komputer developer: salin `.env.resmi.example` menjadi `.env.resmi`, isi:
   `DATABASE_URL` (Session pooler **5432** project baru), `NEXT_PUBLIC_SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, serta email/nama/password superadmin pertama.
   File ini tidak ikut git.
3. Jalankan berurutan (setiap perintah mencetak host database yang dipakai — pastikan itu project resmi):

```bash
pnpm resmi:migrate
pnpm resmi:setup --generus
pnpm resmi:cron
pnpm resmi:check
```

   `resmi:setup` membuat Daerah Klaten Timur 1 → Desa Samber → 13 kelompok dan akun superadmin.
   `--generus` sekaligus memasukkan 302 nama generus (jenis kelamin, tanggal lahir, jenjang masih
   perkiraan dan ditandai di catatan); tanpa flag ini generus diisi lewat menu Import Excel.
   Setup menolak berjalan bila database sudah berisi wilayah.
4. Supabase resmi → **Authentication → Sign In / Providers → Email**: matikan
   **Allow new users to sign up**; **URL Configuration → Site URL** = `https://pantau-generus.vercel.app`.
5. Vercel project `pantau-generus` → **Settings → Environment Variables**, ganti ke project resmi:

| Nama | Nilai |
|---|---|
| `DATABASE_URL` | Supabase resmi → **Connect → Transaction pooler** (port **6543**) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL project resmi |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key project resmi |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key project resmi (rahasia; dipakai menu Akun) |
| `APP_ENV` | `production` |
| `FEATURE_KURIKULUM` | `off` |
| `NEXT_PUBLIC_APP_TIMEZONE` | `Asia/Jakarta` |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` |

   Lalu **Deployments → ⋯ → Redeploy** (env baru hanya berlaku setelah deploy ulang).
6. Login sebagai superadmin di domain resmi → buat akun pengurus dari **Akun & peran**
   (password sementara, wajib diganti saat login pertama).

## Catatan koneksi database

- **Jangan pakai Session pooler (5432) di Vercel**: batasnya ±15 klien untuk semua instance,
  sehingga halaman setelah login gagal dengan `EMAXCONNSESSION max clients reached in session mode`.
  Transaction pooler (6543) cocok untuk server Vercel; aplikasi memakai `prepare: false` dan semua
  query user berjalan di dalam transaksi.
- Di komputer developer: `.env.local` (aplikasi `pnpm dev`) memakai 6543 project **uji**; `.env`
  (migrasi & seed uji) dan `.env.resmi` (migrasi & setup resmi) memakai Session pooler 5432.
- Region fungsi Vercel diatur `sin1` (Singapura) di `vercel.json`, dekat database `ap-southeast-1`.

## Memperbarui

- Kode: push ke `main` → kedua project Vercel deploy otomatis.
- Skema database: buat migrasi (`pnpm db:generate` / migrasi custom), lalu terapkan ke **kedua**
  database **sebelum** push kode yang membutuhkannya:

```bash
pnpm db:migrate
```

```bash
pnpm resmi:migrate
```

- `pnpm db:seed`, `db:seed:kurikulum`, `db:seed:presensi` hanya untuk server uji (semuanya menolak
  `APP_ENV=production`).

## Cek setelah deploy (server resmi)

- [ ] Login tiap peran (superadmin, admin desa, admin kelompok, kyai) — tidak ada menu Kurikulum/Capaian.
- [ ] Buat agenda kelompok, isi presensi manual di HP, lalu matikan internet → isi → nyalakan → tersinkron.
- [ ] Cetak kartu ID satu kelompok (A4, skala 100%, grafis latar aktif), ukur 54 × 85,6 mm,
      lalu pindai QR hasil cetak dari halaman Pindai di HP.
- [ ] Pengajian desa: tunjuk petugas pemindai, pindai beberapa kartu, cek presensi terkunci setelah batas waktu.
- [ ] Pasang sebagai aplikasi (Add to Home Screen) di Android & iPhone.
- [ ] Unduh Excel dari halaman Laporan (tanpa kolom capaian).
