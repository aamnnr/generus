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

export interface Suggestion {
  suggested: boolean;
  /** Alasan singkat yang ditampilkan ke admin, mis. "usia 15 per 1 Juli". */
  reason: string;
}

const ROMAN: Record<string, number> = { vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };

/**
 * Kelas yang tercatat di kolom sekolah, bila ada: "kelas 9", "kls 8", "Kelas IX",
 * "9A", "IX B". Angka/romawi tanpa kata "kelas" hanya dikenali bila diikuti huruf
 * rombel (A–H) agar "SMP N 9" tidak dianggap kelas 9.
 */
export function gradeFromSchool(school: string | null): number | null {
  if (!school) return null;
  const withWord = school.match(/\b(?:kelas|kls|kl)\.?\s*(vii|viii|ix|xii|xi|x|\d{1,2})\b/i);
  const bare = school.match(/\b(VII|VIII|IX|XII|XI|X|7|8|9|10|11|12)\s*[A-H]\b/);
  const raw = (withWord?.[1] ?? bare?.[1])?.toLowerCase();
  if (!raw) return null;
  const n = ROMAN[raw] ?? Number(raw);
  return n >= 1 && n <= 12 ? n : null;
}

/** Kolom sekolah menunjukkan jenjang SLTA ke atas (SMA/SMK/MA, kuliah). */
export function isUpperSchool(school: string | null): boolean {
  if (!school) return false;
  return /\b(sma|smk|sman|smkn|stm|slta|madrasah aliyah|man|kuliah|universitas|univ|politeknik|poltek|institut|stikes|uin|iain)\b/i.test(school) && !/\bsmp\b|\bmts\b/i.test(school);
}

/**
 * Saran kenaikan untuk satu generus. Sistem hanya menyarankan; admin yang memutuskan.
 *
 * Pra Remaja → Remaja (Pelajar/Mandiri), urutan pertimbangan:
 * 1. Tercatat SMA/SMK/MA/kuliah atau kelas 10–12 → disarankan (data sekolah sudah naik).
 * 2. Tercatat kelas 7 atau 8 → TIDAK disarankan, berapa pun usianya.
 * 3. Tercatat kelas 9 → disarankan hanya di awal tahun ajaran (Juli–Agustus), saat kelas 9
 *    berarti baru lulus. Di luar itu ia masih duduk di kelas 9.
 * 4. Tanpa keterangan kelas → usia ≥ 15 per 1 Juli tahun ajaran berjalan.
 *
 * Pelajar → Mandiri: tercatat lulus / semester akhir, atau usia ≥ 23; masih SMA (kelas
 * 10–12) tidak disarankan.
 */
export function suggestPromotion(key: TransitionKey, g: { birthDate: string; school: string | null }, today: Date): Suggestion {
  const age = ageAt(g.birthDate, academicYearStart(today));
  const school = g.school ?? "";
  const grade = gradeFromSchool(school);
  const ageText = `usia ${age} per 1 Juli`;

  if (key === "pelajar-ke-mandiri") {
    if (/\blulus\b/i.test(school)) return { suggested: true, reason: "tercatat lulus" };
    if (/semester\s*(8|9|1[0-4])\b/i.test(school)) return { suggested: true, reason: "kuliah semester akhir" };
    if (grade !== null && grade >= 10) return { suggested: false, reason: `masih kelas ${grade}` };
    if (age >= 23) return { suggested: true, reason: ageText };
    return { suggested: false, reason: ageText };
  }

  if (isUpperSchool(school) || (grade !== null && grade >= 10)) {
    return { suggested: true, reason: grade !== null && grade >= 10 ? `tercatat kelas ${grade}` : "sekolah tercatat SLTA/kuliah" };
  }
  if (grade === 7 || grade === 8) return { suggested: false, reason: `tercatat kelas ${grade}` };
  if (grade === 9) {
    return isPromotionSeason(today)
      ? { suggested: true, reason: "tercatat kelas 9, awal tahun ajaran" }
      : { suggested: false, reason: "masih kelas 9 (naik Juli)" };
  }
  return { suggested: age >= 15, reason: ageText };
}
