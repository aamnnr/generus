// Aturan kenaikan jenjang/kategori. Murni (tanpa DB) supaya bisa dites.
// Lihat PRD F-04: sistem memberi saran, admin yang memutuskan.

export const TRANSITIONS = {
  "pra-ke-pelajar": {
    label: "Pra Remaja → Remaja Pelajar",
    hint: "Lulus SLTP dan melanjutkan sekolah.",
    from: { jenjang: "Pra Remaja", kategori: null },
    to: { jenjang: "Remaja", kategori: "Pelajar" },
  },
  "pra-ke-mandiri": {
    label: "Pra Remaja → Remaja Mandiri",
    hint: "Lulus SLTP dan tidak melanjutkan sekolah.",
    from: { jenjang: "Pra Remaja", kategori: null },
    to: { jenjang: "Remaja", kategori: "Mandiri" },
  },
  "pelajar-ke-mandiri": {
    label: "Remaja Pelajar → Remaja Mandiri",
    hint: "Sudah selesai sekolah/kuliah.",
    from: { jenjang: "Remaja", kategori: "Pelajar" },
    to: { jenjang: "Remaja", kategori: "Mandiri" },
  },
} as const;

export type TransitionKey = keyof typeof TRANSITIONS;

/** Usia (tahun) pada tanggal tertentu. */
export function ageAt(birthDate: string, on: Date): number {
  const [y, m, d] = birthDate.split("-").map(Number);
  let age = on.getFullYear() - y;
  if (on.getMonth() + 1 < m || (on.getMonth() + 1 === m && on.getDate() < d)) age--;
  return age;
}

/** 1 Juli tahun ajaran berjalan: Juli–Desember → tahun ini, Januari–Juni → tahun lalu. */
export function academicYearStart(today: Date): Date {
  const year = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  return new Date(year, 6, 1);
}

/** Awal tahun ajaran (Juli–Agustus): waktu pengingat kenaikan jenjang. */
export function isPromotionSeason(today: Date): boolean {
  return today.getMonth() === 6 || today.getMonth() === 7;
}

/**
 * Apakah generus disarankan naik untuk transisi ini.
 * - Pra Remaja → Remaja: usia ≥ 15 pada awal tahun ajaran, atau tercatat kelas 9.
 *   Saran dipakai untuk kedua tujuan (Pelajar/Mandiri); admin memilih tujuannya.
 * - Pelajar → Mandiri: usia ≥ 23, atau tercatat lulus/kuliah semester akhir.
 */
export function isSuggested(key: TransitionKey, g: { birthDate: string; school: string | null }, today: Date): boolean {
  const age = ageAt(g.birthDate, academicYearStart(today));
  const school = (g.school ?? "").toLowerCase();
  if (key === "pelajar-ke-mandiri") {
    return age >= 23 || /\blulus\b/.test(school) || /semester\s*(8|9|1[0-4])\b/.test(school);
  }
  return age >= 15 || /kelas\s*9\b/.test(school) || /\bix\b/.test(school);
}
