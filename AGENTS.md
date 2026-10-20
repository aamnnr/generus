<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Proyek ini

- Dokumen produk & arsitektur ada di `docs/`. Bahasa UI dan pesan error: Bahasa Indonesia.
- Perubahan tabel: edit `src/db/schema.ts` lalu `pnpm db:generate`. Fungsi/trigger/RLS ditulis manual di migrasi custom (lihat `drizzle/0002_rls.sql`).
- Setiap aturan akses (RLS) wajib punya tes di `tests/db/` (PGlite, tanpa Docker). Jalankan `pnpm test`.
- `src/db/index.ts` memakai koneksi yang melewati RLS; query atas nama user harus lewat role `authenticated`.
- Auth: lihat docs/ARCHITECTURE.md §4b. Baca sesi hanya lewat `src/lib/auth.ts`; query user lewat `withRls`. Jangan aktifkan `writeCookies` di luar aksi yang mengubah sesi.
- Next 16 + cacheComponents: komponen yang membaca sesi/params/searchParams harus di dalam `<Suspense>`. Dokumentasi resmi ada di `node_modules/next/dist/docs/`.
