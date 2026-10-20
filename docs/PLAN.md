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
- [x] Import Excel dari template: pratinjau per baris (OK/bermasalah/duplikat), hanya kelompok dalam lingkup, simpan dalam satu transaksi. `pnpm seed:xlsx` membuat file contoh.
- [x] Kenaikan jenjang/kategori massal (/generus/kenaikan): saran otomatis per usia 1 Juli & kelas, centang lalu simpan; pengingat di beranda Juli–Agustus.
- [x] PWA dasar: manifest + ikon (dibuat dari kode), service worker (cache aset statis + halaman offline, tanpa menyimpan data pribadi), banner offline (`useOffline`), ajakan pasang aplikasi (Android & iOS).

**Selesai bila:** akun uji Admin Kelompok bisa login dari HP dan melihat/mengelola hanya generus kelompoknya (data seed). Import diuji dengan file template berisi data seed.

## Fase 2 — Agenda & Presensi Manual (±2 minggu)
- [x] CRUD agenda (sekali & berulang mingguan hingga 26 pekan), sasaran jenjang/kategori/gender, batalkan satu/seri.
- [x] Agenda tingkat atas tampil di unit bawahnya; admin kelompok melengkapi presensi anggotanya (delegasi) sampai batas waktu.
- [x] Checklist presensi manual (H/T/I/S/A, simpan sekaligus, "hadirkan semua yang belum").
- [x] Checklist presensi offline-first: tiap ketukan disimpan di antrian IndexedDB (Dexie), dikirim di latar belakang & saat online, bertahan walau halaman ditutup. (Membuka halaman agenda dari nol saat offline menyusul di Fase 3 bersama unduhan roster.)
- [x] Penguncian otomatis + `alpa` default: `app.lock_due_agendas()` dipanggil saat halaman agenda dibuka & terjadwal via `pnpm db:cron` (pg_cron); kunci manual oleh pengelola.
- [x] Rekap presensi per agenda (per status & per kelompok) dan per generus (persentase + riwayat).

**Uji internal 1:** simulasikan beberapa minggu agenda & presensi manual dengan akun uji per peran (data seed), termasuk mode offline.

## Fase 3 — Presensi QR untuk Desa/Daerah (±2 minggu)
- [x] Kartu QR: cetak massal per desa/kelompok atau per generus (A4, 10 kartu ukuran KTP, cetak/simpan PDF dari browser); terbitkan ulang kartu hilang.
- [x] Pemindai `/pindai`: unduh roster (hash SHA-256 isi QR, bukan token), kamera (BarcodeDetector bawaan / zxing-wasm lokal), bunyi & getar, hadir/terlambat otomatis, antrian offline, scan pertama menang. Bisa dibuka dari nol saat offline (kerangka di-cache service worker).
- [x] Banyak petugas per agenda: pengelola menunjuk akun sebagai petugas scan sampai batas pelengkapan presensi; tugas tampil di beranda petugas.
- [x] Delegasi ke Admin Kelompok (izin/sakit/lupa kartu) sampai `delegate_until` (dibangun di Fase 2).
- [x] Cadangan cari-nama dan kolom kode untuk scanner QR USB/Bluetooth.
- [ ] Uji lapangan: simulasi 200+ scan dengan 3 HP, sebagian offline.

**Uji internal 2:** simulasi pengajian desa: cetak ±200 kartu QR dari data seed, 3 HP memindai bersamaan (sebagian offline). Ukur waktu check-in (target PRD G2).

## Fase 4 — Kurikulum, Target & Capaian (±3 minggu) ✅
Format acuan: dokumen "Target Materi Pembelajaran Remaja — Periode Bulan Oktober" Tim Kurikulum PPG.
- [x] 4a. Skema + RLS + tes (`drizzle/0009–0010`, `tests/db/kurikulum.test.ts`, `src/lib/quran.ts`, `pnpm db:seed:kurikulum`): `curriculum_periods`, `kitab`, `materi`, `period_targets`, `achievements`, `target_deliveries`, `kitab_progress`; data surat Al-Qur'an (114 surat, 6236 ayat) untuk konversi surat:ayat; seed contoh periode Oktober 2026.
- [x] 4b. Tim Kurikulum (`/kurikulum`, `/kurikulum/materi`, `/kurikulum/kitab`): pustaka materi & lintasan kitab; periode + penyusun target per jenjang (form, salin periode, terbitkan).
- [x] 4c. Tampilan target periode berjalan (`/kurikulum/periode/[id]` baca-saja + kartu di beranda) (mirip dokumen PPG, termasuk lampiran dalil & doa berteks Arab) untuk semua peran.
- [x] 4d. Admin Kelompok (`/capaian`, `/capaian/target/[id]`, `/capaian/kitab/[id]`, `/capaian/generus/[id]`): capaian massal per materi / per generus, tanda "sudah disampaikan", progres kitab massal (surat:ayat / halaman).
- [x] 4e. Rekap capaian lintas unit `/capaian/rekap` (daerah → desa → kelompok, per target; juga untuk Tim Kurikulum lewat fungsi agregat `app.capaian_rekap_*`) + kartu capaian di beranda.

## Fase 5 — Dashboard & Laporan (±2 minggu) ✅
- [x] Agregat presensi & capaian lewat fungsi SQL `app.kehadiran_*`, `app.laporan_generus`, `app.peringatan_alpa`, `app.capaian_rekap_*` (dihitung per kelompok sekali lalu dijumlahkan). Materialized view **ditunda**: pada skala satu daerah (±5.000 generus, ±40 rb presensi/2 bulan) query langsung cukup cepat (±200 ms); dipertimbangkan lagi bila laporan melambat.
- [x] Dashboard `/laporan` per tingkat + drill-down Daerah → Desa → Kelompok → Generus, tren kehadiran 6 bulan.
- [x] Peringatan: alpa 3× berturut-turut; kelompok yang belum mengisi capaian (ditandai merah bila periode berakhir ≤ 7 hari).
- [x] Ekspor Excel (`/laporan/ekspor`: ringkasan, per generus, peringatan) & cetak/simpan PDF dari browser.
- [x] Data contoh presensi: `pnpm db:seed:presensi` (8 pekan pengajian rutin per kelompok, terkunci).

## Persiapan Pilot (±1–2 minggu, setelah Fase 5)
- [ ] Pilih 1 desa (± 4–6 kelompok) sebagai **pilot**.
- [ ] Kumpulkan data asli desa pilot memakai [public/templates/Template_Data_Generus.xlsx](../public/templates/Template_Data_Generus.xlsx).
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
