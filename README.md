# Generus — Sistem Pemantauan Ketertiban Generus

PWA untuk presensi pengajian, target materi bulanan, dan progres kitab di tingkat daerah, desa, dan kelompok.

- Kebutuhan produk: [docs/PRD.md](docs/PRD.md)
- Arsitektur & model data: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Rencana fase: [docs/PLAN.md](docs/PLAN.md)
- Template pengumpulan data: [templates/Template_Data_Generus.xlsx](templates/Template_Data_Generus.xlsx)

## Stack

Next.js (App Router) · TypeScript · Tailwind · PostgreSQL di Supabase (Auth + RLS + `ltree`) · Drizzle ORM · Vitest + PGlite.

## Mulai

Butuh Node.js ≥ 22 dan pnpm.

```bash
pnpm install
pnpm test        # tes database (migrasi + RLS) dengan PGlite, tanpa Docker/Supabase
pnpm dev         # http://localhost:3000
```

### Menyambungkan ke Supabase

1. Buat project di [supabase.com](https://supabase.com) (region Singapore).
2. Salin `.env.example` menjadi `.env` **dan** `.env.local`, lalu isi nilai dari dashboard Supabase.
3. Jalankan migrasi lalu data contoh:

```bash
pnpm db:migrate
pnpm db:seed
```

`db:seed` membuat 1 daerah, 10 desa, 60 kelompok, ± 5.000 generus contoh, dan 8 akun uji `*@generus.test` (satu per peran) dengan password dari `SEED_USER_PASSWORD`. Pakai `pnpm db:seed --reset` untuk mengisi ulang. Seed menolak berjalan jika `APP_ENV=production`.

## Struktur

```
docs/                 PRD, arsitektur, rencana
drizzle/              migrasi SQL (0000 ekstensi, 0001 tabel, 0002 fungsi+trigger+RLS)
scripts/seed/         pembuat data contoh & penulis ke database
src/app/              halaman Next.js
src/db/schema.ts      skema Drizzle (sumber tabel)
src/lib/env.ts        validasi environment server
tests/db/             tes migrasi, RLS, dan seed (PGlite)
templates/            template Excel untuk admin
```

## Alur perubahan database

1. Ubah tabel di `src/db/schema.ts` → `pnpm db:generate` membuat migrasi baru.
2. Fungsi, trigger, dan kebijakan RLS ditulis manual: `pnpm db:generate --custom --name=<nama>` lalu isi file SQL-nya.
3. Tambah/ubah tes di `tests/db/` — setiap aturan akses harus punya tes.

## Perintah

| Perintah | Fungsi |
|----------|--------|
| `pnpm dev` | Server development |
| `pnpm build` | Build produksi |
| `pnpm lint` / `pnpm typecheck` | Pemeriksaan kode |
| `pnpm test` | Tes (migrasi, RLS, seed) |
| `pnpm db:generate` | Buat migrasi dari perubahan skema |
| `pnpm db:migrate` | Terapkan migrasi ke `DATABASE_URL` |
| `pnpm db:seed` | Isi data contoh |
