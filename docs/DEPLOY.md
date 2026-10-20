# Deploy Uji Coba (Vercel + Supabase)

Uji coba memakai **project Supabase yang sama dengan development** (data Desa Samber,
Daerah Klaten Timur 1). Konsekuensinya: perubahan di dev langsung terlihat di aplikasi
uji coba, dan `pnpm db:seed --reset` **menghapus data uji coba** — jangan dijalankan
setelah admin mulai mengisi data. Pisahkan project production sebelum dipakai sungguhan
(lihat PLAN.md, Persiapan Pilot).

## 1. Supabase (sekali saja)

Sudah dilakukan untuk project ini:
- Migrasi `drizzle/0000`–`0013` (`pnpm db:migrate`).
- Data Samber + akun uji (`pnpm db:seed`), kurikulum Oktober 2026 (`pnpm db:seed:kurikulum`).
- Penguncian presensi otomatis tiap 15 menit (`pnpm db:cron`, pg_cron).

Lakukan di dashboard Supabase:
1. **Authentication → Sign In / Providers → Email**: matikan **Allow new users to sign up**.
   Semua akun dibuat superadmin dari menu *Akun & peran*.
2. **Authentication → URL Configuration**: isi **Site URL** dengan domain Vercel
   (mis. `https://generus.vercel.app`).
3. Pastikan `SEED_USER_PASSWORD` (password semua akun `*@generus.test`) kuat, atau ganti
   password akun uji lewat menu *Akun & peran → Reset password*. Aplikasi akan bisa diakses publik.

## 2. Vercel

1. Push repo ke GitHub, lalu **Add New → Project** di Vercel dan pilih repo ini.
   Framework terdeteksi otomatis (Next.js); build command `pnpm build`.
2. Region fungsi sudah diatur `sin1` (Singapura) di `vercel.json` — dekat dengan database
   Supabase `ap-southeast-1`. Jangan diubah: tiap halaman menjalankan beberapa query berurutan.
3. **Settings → Environment Variables** (Production & Preview):

| Nama | Nilai |
|---|---|
| `DATABASE_URL` | Supabase → **Connect → Transaction pooler** (port **6543**), bukan 5432 |
| `NEXT_PUBLIC_SUPABASE_URL` | sama dengan `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sama dengan `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | sama dengan `.env.local` (rahasia; dipakai menu Akun) |
| `APP_ENV` | `staging` |
| `NEXT_PUBLIC_APP_TIMEZONE` | `Asia/Jakarta` |

   **Jangan pakai Session pooler (5432) di Vercel**: batasnya ±15 klien untuk semua instance
   (ditambah server dev & script lokal), sehingga halaman setelah login gagal dengan
   `EMAXCONNSESSION max clients reached in session mode`. Setelah mengubah env, **Redeploy**.
   Transaction pooler cocok untuk server Vercel yang membuka banyak koneksi singkat;
   aplikasi sudah memakai `prepare: false` dan semua query user berjalan di dalam transaksi.
   Di komputer developer: `.env.local` (aplikasi `pnpm dev`) juga memakai 6543, sedangkan `.env`
   (migrasi & seed) tetap Session pooler 5432.
4. **Deploy**. Setelah selesai, buka domainnya dan login sebagai `superadmin@generus.test`.

## 3. Cek setelah deploy

- [ ] Login tiap peran (superadmin, admin desa, admin kelompok, kyai, kurikulum) — menu sesuai peran.
- [ ] Buat agenda kelompok, isi presensi manual di HP, lalu matikan internet → isi → nyalakan → tersinkron.
- [ ] Cetak kartu ID satu kelompok (A4, skala 100%, grafis latar aktif), ukur 54 × 85,6 mm,
      lalu pindai QR hasil cetak dari halaman Pindai di HP.
- [ ] Pasang sebagai aplikasi (Add to Home Screen) di Android & iPhone.
- [ ] Unduh Excel dari halaman Laporan.

## Memperbarui

- Kode: push ke branch utama → Vercel deploy otomatis.
- Skema database: `pnpm db:generate` / migrasi custom, lalu `pnpm db:migrate` dari komputer
  developer (memakai `.env`), **sebelum** push kode yang membutuhkannya.
