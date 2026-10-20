# PLAN — Rencana Implementasi

> Versi 0.4 · 2026-10-20 · Lihat [PRD.md](PRD.md) dan [ARCHITECTURE.md](ARCHITECTURE.md)

Estimasi untuk 1–2 developer.

**Strategi data (diputuskan 2026-10-20):** pengumpulan data asli dan pemilihan desa pilot ditunda. Fase 1–5 dikembangkan dan diuji dengan **data seed** (`pnpm db:seed`) dan akun uji `*@generus.test`. Data asli baru dibutuhkan di **Persiapan Pilot** sebelum rollout.

## Fase 0 — Persiapan (±1 minggu)
- [x] Semua keputusan produk sudah dijawab (PRD §8).
- [~] ~~Kumpulkan data awal~~ dan ~~pilih desa pilot~~ → dipindah ke **Persiapan Pilot**.
- [x] Setup repo: Next.js + TypeScript + Tailwind, Drizzle, Vitest + PGlite, CI (lint, typecheck, test, build), script data contoh.
- [x] Project Supabase development: migrasi + seed diterapkan, RLS terverifikasi (`pnpm db:check`).
- [x] shadcn/ui (preset base-nova) terpasang.

## Fase 1 — Fondasi (±2–3 minggu)
- [x] Skema DB: `units` (ltree), `profiles`, `user_roles`, `jenjang` + `jenjang_kategori`, `generus` + riwayat status, `audit_log`.
- [x] Fungsi lingkup (`app.scope_paths`, `app.has_role_in`, `app.can_mutate`) + kebijakan RLS + tes (PGlite).
- [x] Login (email + password), logout, ganti password (wajib untuk password sementara).
- [x] Manajemen akun & peran oleh Superadmin: buat akun + password sementara, multi-peran, nonaktifkan (blokir login), reset password.
- [x] Kelola pohon wilayah (Superadmin): tambah/ubah nama/hapus desa & kelompok kosong.
- [x] CRUD generus sesuai lingkup (filter wilayah/jenjang/status, paginasi), Kyai read-only.
- [x] Tandai Menikah / Pindah Sambung + aktifkan kembali (QR otomatis nonaktif), mutasi kelompok (admin desa/daerah), riwayat.
- [ ] Import Excel dari template.
- [ ] Kenaikan jenjang/kategori massal.
- [ ] PWA dasar: manifest, ikon, service worker, install prompt.

**Selesai bila:** akun uji Admin Kelompok bisa login dari HP dan melihat/mengelola hanya generus kelompoknya (data seed). Import diuji dengan file template berisi data seed.

## Fase 2 — Agenda & Presensi Manual (±2 minggu)
- [ ] CRUD agenda (sekali & berulang mingguan), filter jenjang/kategori/gender.
- [ ] Agenda tingkat atas tampil di unit bawahnya.
- [ ] Checklist presensi manual (offline via outbox Dexie).
- [ ] Penguncian otomatis + `alpa` default (cron).
- [ ] Rekap presensi sederhana per agenda & per generus.

**Uji internal 1:** simulasikan beberapa minggu agenda & presensi manual dengan akun uji per peran (data seed), termasuk mode offline.

## Fase 3 — Presensi QR untuk Desa/Daerah (±2 minggu)
- [ ] Generate `qr_token` + cetak kartu QR massal (PDF A4).
- [ ] Modul scanner: unduh roster, scan kamera, umpan balik suara/getar, offline outbox, sinkron idempoten.
- [ ] Banyak petugas per agenda + akses "petugas scan" sementara.
- [ ] Delegasi ke Admin Kelompok (izin/sakit/lupa kartu) sampai `delegate_until`.
- [ ] Cadangan cari-nama.
- [ ] Uji lapangan: simulasi 200+ scan dengan 3 HP, sebagian offline.

**Uji internal 2:** simulasi pengajian desa: cetak ±200 kartu QR dari data seed, 3 HP memindai bersamaan (sebagian offline). Ukur waktu check-in (target PRD G2).

## Fase 4 — Kurikulum, Target & Capaian (±3 minggu)
- [ ] CRUD materi & kitab per jenjang & kategori (peran Tim Kurikulum).
- [ ] Target bulanan + salin dari bulan lalu.
- [ ] Input capaian massal per materi / per generus.
- [ ] Progres kitab per generus (riwayat posisi + input massal untuk yang mengaji bersama).
- [ ] Tampilan read-only untuk Kyai (dashboard capaian & rekap per generus).

## Fase 5 — Dashboard & Laporan (±2 minggu)
- [ ] Materialized views kehadiran & capaian bulanan.
- [ ] Dashboard per tingkat + drill-down Daerah → Desa → Kelompok → Generus.
- [ ] Peringatan (alpa beruntun, capaian belum diisi).
- [ ] Ekspor Excel/PDF laporan bulanan.

## Persiapan Pilot (±1–2 minggu, setelah Fase 5)
- [ ] Pilih 1 desa (± 4–6 kelompok) sebagai **pilot**.
- [ ] Kumpulkan data asli desa pilot memakai [templates/Template_Data_Generus.xlsx](../templates/Template_Data_Generus.xlsx).
- [ ] Project Supabase **staging/production** terpisah dari development (data seed tidak boleh tercampur data asli).
- [ ] Import data pilot, buat akun asli, cetak kartu QR.
- [ ] Pilot 2–4 minggu: presensi kelompok (manual) + minimal satu pengajian desa (scan QR). Kumpulkan masukan & perbaiki.

## Fase 6 — Rollout Daerah (±2–4 minggu, bertahap)
- [ ] Pelatihan per desa (admin + petugas scan), panduan singkat bergambar.
- [ ] Import data seluruh desa, cetak & bagikan kartu QR.
- [ ] Onboarding desa satu per satu; pantau error via Sentry.
- [ ] Backup & prosedur pemulihan teruji.

**Total perkiraan:** ± 3–4 bulan sampai seluruh daerah memakai.

## Backlog (setelah v1)
- Self check-in QR dinamis untuk generus remaja (butuh akun generus).
- Portal orang tua (lihat kehadiran & capaian anak).
- Notifikasi WhatsApp (pengingat agenda, laporan bulanan ke kyai).
- Multi-daerah (multi-tenant), bila ada daerah lain yang ingin memakai.
- App scanner Kotlin kecil bila ada kendala scan di HP tertentu.

## Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Admin kurang terbiasa teknologi | Data tidak diisi | UI sangat sederhana, pelatihan, pilot kecil dulu |
| Sinyal buruk di lokasi pengajian | Presensi gagal | Offline-first + roster diunduh sebelumnya |
| Kartu QR hilang/tertinggal | Generus tidak tercatat | Cari-nama + delegasi kelompok + cetak ulang |
| Titip absen (kartu dibawa orang lain) | Data tidak jujur | Petugas melihat nama di layar saat scan; audit metode presensi |
| Data anak bocor | Kepercayaan hilang | RLS, data minimal, token QR acak, audit log |
| Struktur/jenjang berubah | Laporan rancu | Jenjang dapat dikonfigurasi, snapshot peserta saat agenda dikunci |
