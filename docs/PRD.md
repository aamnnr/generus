# PRD — Sistem Pemantauan Ketertiban Generus

> Versi 0.3 · 2026-10-20 · Status: Draft (semua keputusan masuk, lihat §8)

## 1. Latar Belakang

Pembinaan generus berjalan di tiga tingkat: **Daerah → Desa → Kelompok**. Saat ini presensi pengajian, capaian materi bulanan, dan progres kitab dicatat terpisah (buku, spreadsheet, grup chat), sehingga:

- Pengurus di tingkat atas sulit melihat kondisi tingkat di bawahnya secara cepat.
- Presensi kegiatan desa/daerah (peserta ratusan orang) lambat dan rawan salah jika diinput manual.
- Target kurikulum dari tim PPG tidak bisa dipantau capaiannya per generus/kelompok.

## 2. Tujuan

| # | Tujuan | Indikator keberhasilan |
|---|--------|------------------------|
| G1 | Presensi semua tingkat tercatat digital | ≥ 90% kegiatan terjadwal punya data presensi dalam 24 jam |
| G2 | Presensi kegiatan besar cepat | Check-in 300 peserta selesai < 15 menit dengan 3–4 petugas |
| G3 | Capaian target materi & kitab terpantau | Setiap kelompok mengisi progres materi tiap bulan |
| G4 | Pengurus melihat laporan sesuai wilayahnya | Dashboard per tingkat tersedia tanpa rekap manual |

**Bukan tujuan (v1):** penilaian akhlak/kepribadian, keuangan, chat, aplikasi khusus untuk generus/orang tua.

## 3. Pengguna & Peran

Setiap akun terikat pada **satu unit wilayah** (daerah/desa/kelompok). Hak akses berlaku untuk unit itu **dan seluruh unit di bawahnya**.

| Peran | Lingkup | Kemampuan utama |
|-------|---------|-----------------|
| **Superadmin** | Seluruh sistem | Kelola struktur wilayah, akun, peran, jenjang, konfigurasi |
| **Tim Kurikulum PPG** | Daerah | Kelola kurikulum: materi, kitab, target bulanan per jenjang; melihat laporan capaian. Tidak mengakses presensi/data master |
| **Admin Daerah** | Daerah + turunannya | Kelola agenda daerah, presensi daerah, data desa, laporan |
| **Admin Desa** | Desa + turunannya | Kelola agenda desa, presensi desa, data kelompok, laporan |
| **Admin Kelompok** | Kelompok | Kelola data generus, agenda kelompok, presensi, input progres materi/kitab |
| **Kyai Daerah/Desa/Kelompok** | Sesuai unit | **Hanya melihat**: dashboard, laporan presensi & capaian, rekap per generus |

Catatan:
- Generus **bukan pengguna** di v1; mereka adalah data yang dikelola admin. (Akun generus/orang tua masuk backlog.)
- Satu orang boleh memegang lebih dari satu peran (mis. Admin Kelompok + Kyai Kelompok). Jika anggota tim kurikulum juga Admin Daerah, ia cukup diberi kedua peran.
- **Input target oleh Tim Kurikulum, bukan Admin Daerah.** Tim kurikulum adalah pemilik isi kurikulum, jadi merekalah yang menginput; Admin Daerah fokus pada operasional (agenda, presensi, data). Pemisahan ini juga mencegah target berubah tanpa sepengetahuan tim kurikulum.
- **Petugas presensi**: admin bisa memberi akses sementara "scanner" ke orang lain untuk satu agenda (tanpa akses data lain).

## 4. Konsep Domain

- **Unit wilayah**: pohon Daerah → Desa → Kelompok.
- **Generus**: anggota yang terdaftar di tepat satu kelompok, punya **kode QR unik**, jenjang, dan status keanggotaan.
- **Jenjang** (saat ini; tetap dapat dikonfigurasi Superadmin):
  - **Pra Remaja** — generus yang masih sekolah SLTP. Tanpa kategori.
  - **Remaja**, dengan kategori:
    - **Pelajar** — masih sekolah/kuliah.
    - **Mandiri** — sudah tidak sekolah (bekerja, dll.).
  Target kurikulum dapat ditetapkan per jenjang, atau khusus satu kategori Remaja (mis. hanya Remaja Mandiri).
- **Status generus**:
  - `aktif` — dihitung dalam presensi & target. Tidak ada batas usia: generus tetap aktif sampai menikah.
  - `pindah_sambung` — pindah tempat tinggal ke luar cakupan daerah; tidak lagi dihitung, data historis disimpan.
  - `menikah` — sudah tidak termasuk generus; tidak lagi dihitung, data historis disimpan.
- **Pindah kelompok** di dalam daerah bukan status, melainkan *mutasi*: generus dipindah ke kelompok baru, riwayat tetap ada.
- **Generus pindahan dari luar daerah** cukup didaftarkan seperti generus baru, tanpa keterangan asal.
- **Agenda**: kegiatan pengajian milik satu unit. Peserta yang diharapkan = generus di unit tersebut beserta turunannya, bisa difilter jenjang/jenis kelamin.
- **Kurikulum**: daftar materi (hafalan, doa, praktik, dll.) dan kitab (dengan bab/halaman), dikelompokkan per jenjang.
- **Target bulanan**: materi/kitab yang harus dicapai jenjang tertentu pada bulan tertentu.
- **Capaian**: status per generus per item target — `belum`, `proses`, `tuntas` — diisi Admin Kelompok.

## 5. Kebutuhan Fungsional

### 5.1 Struktur & Data Master
- F-01 Superadmin mengelola pohon Daerah/Desa/Kelompok.
- F-02 Admin Kelompok mengelola data generus (CRUD, import CSV/Excel). Mutasi antar kelompok dalam daerah dilakukan Admin Desa/Daerah, dengan riwayat.
- F-03 Sistem membuat kode QR unik per generus; kartu QR bisa dicetak massal (PDF, 8–10 kartu per A4).
- F-04 Jenjang & kategori dikonfigurasi Superadmin. Perpindahan jenjang/kategori dilakukan admin, dibantu pengingat di awal tahun ajaran (Juli):
  - Pra Remaja yang lulus SLTP → Remaja Pelajar (atau Remaja Mandiri bila tidak melanjutkan sekolah).
  - Remaja Pelajar yang selesai sekolah/kuliah → Remaja Mandiri.
  Admin dapat memproses kenaikan secara massal (centang beberapa generus → ubah jenjang/kategori).
- F-05 Admin Kelompok menandai generus **Menikah** atau **Pindah Sambung** (dengan tanggal & keterangan, mis. daerah tujuan). Sejak tanggal itu generus keluar dari sasaran agenda dan target, kartu QR-nya nonaktif, tetapi riwayat presensi & capaian tetap tersimpan dan tampil di laporan periode sebelumnya.

### 5.2 Agenda
- F-10 Admin tiap tingkat membuat agenda (sekali atau berulang mingguan), dengan lokasi, waktu, jenjang sasaran.
- F-11 Agenda desa/daerah otomatis tampil di dashboard unit-unit di bawahnya.
- F-12 Agenda bisa dibatalkan/diubah; perubahan tercatat.

### 5.3 Presensi
Status presensi: `hadir`, `terlambat`, `izin`, `sakit`, `alpa`.

- F-20 **Checklist manual** — untuk kegiatan kelompok: daftar generus sasaran, ketuk status. Default semua `alpa` sampai diubah.
- F-21 **Scan QR kartu generus** — untuk kegiatan desa/daerah: petugas memindai kartu QR generus dengan kamera HP. Banyak petugas bisa memindai bersamaan di satu agenda. Duplikasi otomatis diabaikan. `terlambat` ditentukan dari batas waktu agenda.
- F-22 **Delegasi ke kelompok** — untuk agenda desa/daerah, Admin Kelompok dapat melengkapi presensi anggotanya sendiri (mis. menandai izin/sakit, atau hadir bila lupa membawa kartu) dalam batas waktu (default H+2).
- F-23 **Pencarian nama** sebagai cadangan scan (kartu hilang/rusak), dibatasi pada generus sasaran.
- F-24 Presensi **berjalan offline**: hasil scan disimpan di perangkat dan disinkronkan otomatis saat online.
- F-25 Presensi dikunci setelah batas waktu; perubahan setelahnya hanya oleh admin pemilik agenda, dengan jejak audit.
- F-26 *(Fase 2)* Self check-in: QR agenda yang berganti tiap 30 detik ditampilkan di layar, dipindai generus yang punya akun.

### 5.4 Kurikulum, Target & Capaian
- F-30 Tim Kurikulum mengelola daftar materi dan kitab per jenjang/kategori (kitab: bab/halaman sebagai satuan progres).
- F-31 Tim Kurikulum menetapkan target bulanan per jenjang/kategori (materi + rentang kitab), bisa disalin dari bulan sebelumnya.
- F-32 Admin Kelompok mengisi capaian per generus (massal per materi atau per generus).
- F-33 Progres kitab dicatat **per generus** sebagai posisi terakhir (bab/halaman), dengan riwayat tanggal. Input massal tersedia: pilih beberapa generus yang mengaji bersama → set posisi yang sama sekaligus.

### 5.5 Laporan & Dashboard
- F-40 Dashboard per tingkat: persentase kehadiran, tren mingguan/bulanan, capaian target bulan berjalan, unit dengan kinerja terendah.
- F-41 Drill-down: Daerah → Desa → Kelompok → Generus.
- F-42 Rekap per generus: riwayat hadir & capaian (berguna untuk pembinaan individu).
- F-43 Peringatan: generus alpa ≥ 3 kali berturut-turut; kelompok belum mengisi capaian menjelang akhir bulan.
- F-44 Ekspor Excel/PDF untuk laporan bulanan.

## 6. Kebutuhan Non-Fungsional

| Area | Kebutuhan |
|------|-----------|
| Platform | Bisa dipasang di HP Android & iPhone (PWA), dan dipakai di laptop |
| Offline | Scan & checklist presensi tetap berjalan tanpa sinyal |
| Kinerja | Scan → konfirmasi < 1 detik (lokal); dashboard < 3 detik |
| Skala awal | ± 1 daerah, 10 desa, 60 kelompok, 5.000 generus, 50–150 agenda/minggu |
| Keamanan | Data hanya terlihat dalam lingkup unit pengguna (ditegakkan di database) |
| Privasi | Data anak dibatasi: tanpa foto wajib, tanpa NIK; QR berisi token acak, bukan data pribadi |
| Audit | Semua perubahan presensi & capaian tercatat (siapa, kapan, sebelum/sesudah) |
| Bahasa | Antarmuka Bahasa Indonesia |

## 7. Rekomendasi Presensi Kegiatan Desa/Daerah (ringkasan keputusan)

1. **Utama — kartu QR generus + banyak petugas pemindai.** Generus tidak perlu HP; cukup kartu (laminasi/gantungan). 3–4 petugas di pintu memindai dengan HP masing-masing, offline-capable. Satu scan ± 2 detik → 300 orang ≈ 10 menit dengan 3 petugas.
2. **Pelengkap — delegasi ke Admin Kelompok** untuk izin/sakit dan kasus lupa kartu, karena admin kelompoklah yang paling mengenal anggotanya.
3. **Cadangan — cari nama** di aplikasi petugas.
4. **Fase 2 — self check-in QR dinamis** bila generus remaja sudah punya akun.

Alasan tidak memilih alternatif lain:
- *Admin desa input manual* → tidak skala untuk ratusan peserta.
- *Self check-in generus sejak awal* → tidak semua generus (terutama pra remaja) punya/membawa HP; rawan titip absen.
- *NFC/RFID* → butuh perangkat khusus dan tidak didukung di iPhone via web.
- *Pengenalan wajah* → isu privasi data anak, biaya dan akurasi.

## 8. Keputusan

| # | Topik | Keputusan |
|---|-------|-----------|
| 1 | Input target kurikulum | Peran tersendiri **Tim Kurikulum PPG** di tingkat daerah |
| 2 | Jenjang | Pra Remaja (SLTP, tanpa kategori); Remaja (Pelajar & Mandiri) — dapat dikonfigurasi |
| 3 | Progres kitab | Dicatat per generus |
| 4 | Kyai | Hanya melihat (read-only) |
| 5 | Cakupan | Satu daerah (single-tenant). Pohon wilayah tetap berakar di "Daerah" agar bisa diperluas kelak |
| 6 | Keluar dari generus | Status **Menikah** atau **Pindah Sambung**; data historis disimpan, tidak dihitung lagi |
| 7 | Batas keanggotaan | Tidak ada batas usia; generus tetap aktif sampai menikah |
| 8 | Generus pindahan masuk | Didaftarkan sebagai generus baru, tanpa keterangan asal |

Saat ini tidak ada pertanyaan terbuka.
