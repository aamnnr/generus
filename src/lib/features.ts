// Saklar modul per server (lihat docs/DEPLOY.md, "Dua server").
//
// Penerapan bertahap: server RESMI menjalankan Tahap 1 (Database Generus &
// Presensi) dengan FEATURE_KURIKULUM=off; server UJI menjalankan semua fitur.

/**
 * Modul Kurikulum, Target Materi, dan Capaian (termasuk rekap & kolom capaian
 * di laporan). Aktif kecuali FEATURE_KURIKULUM bernilai "off"/"0"/"false".
 */
export function kurikulumEnabled(): boolean {
  const v = (process.env.FEATURE_KURIKULUM ?? "on").trim().toLowerCase();
  return !["off", "0", "false", "no"].includes(v);
}

/** Awal path yang termasuk modul kurikulum (dialihkan bila modul mati). */
export const KURIKULUM_PATHS = ["/kurikulum", "/capaian"];
