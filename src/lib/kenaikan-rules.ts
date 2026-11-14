// Aturan kenaikan jenjang/kategori. Murni (tanpa DB) supaya bisa dites.
// Lihat PRD F-04: sistem memberi saran, admin yang memutuskan.

export const TRANSITIONS = {
  "balita-ke-paud": {
    label: "Balita → Caberawit PAUD/TK",
    hint: "Mulai masuk PAUD/TK/KB.",
    from: { jenjang: "Balita", kategori: null },
    to: { jenjang: "Caberawit", kategori: "PAUD/TK" },
  },
  "paud-ke-sd": {
    label: "Caberawit PAUD/TK → Caberawit SD",
    hint: "Lulus TK dan masuk SD/MI.",
    from: { jenjang: "Caberawit", kategori: "PAUD/TK" },
    to: { jenjang: "Caberawit", kategori: "SD" },
  },
  "sd-ke-pra": {
    label: "Caberawit SD → Pra Remaja",
    hint: "Lulus SD/MI (kelas 6) dan masuk SLTP.",
    from: { jenjang: "Caberawit", kategori: "SD" },
    to: { jenjang: "Pra Remaja", kategori: null },
  },
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

/** "Remaja Pelajar", atau "Pra Remaja" untuk jenjang tanpa kategori. */
export function segmentLabel(x: { jenjang: string; kategori: string | null }): string {
  return x.kategori ? `${x.jenjang} ${x.kategori}` : x.jenjang;
}

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

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };

/**
 * Kelas yang tercatat di kolom sekolah, bila ada: "kelas 9", "kls 8", "Kelas IX",
 * "kelas 3", "9A", "IX B". Tanpa kata "kelas", angka/romawi hanya dikenali bila
 * diikuti huruf rombel (A–H) agar "SMP N 9" / "SDN 2" tidak dianggap kelas.
 */
export function gradeFromSchool(school: string | null): number | null {
  if (!school) return null;
  const withWord = school.match(/\b(?:kelas|kls|kl)\.?\s*(viii|vii|vi|iv|v|iii|ii|ix|i|xii|xi|x|\d{1,2})\b/i);
  const bare = school.match(/\b(VIII|VII|IX|XII|XI|X|1[0-2]|[1-9])\s*[A-H]\b/);
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

/** Kolom sekolah menunjukkan SLTP (SMP/MTs). */
export function isLowerSecondary(school: string | null): boolean {
  return !!school && /\b(smp|smpn|smpit|mts|mtsn|sltp)\b/i.test(school);
}

/** Kolom sekolah menunjukkan SD/MI. */
export function isElementary(school: string | null): boolean {
  return !!school && /\b(sd|sdn|sdit|mi|min)\b/i.test(school);
}

/** Kolom sekolah menunjukkan PAUD/TK/KB/RA. */
export function isPreschool(school: string | null): boolean {
  return !!school && /\b(paud|tk|tka|kb|ra|playgroup)\b/i.test(school);
}

/**
 * Saran naik dari jenjang sekolah yang berakhir di kelas `last` (6 untuk SD, 9 untuk
 * SLTP): sudah di jenjang sekolah berikutnya → ya; kelas di bawah `last` → tidak; kelas
 * `last` → hanya di awal tahun ajaran (berarti baru lulus); tanpa keterangan → usia.
 */
function byGrade(o: { grade: number | null; next: boolean; last: number; age: number; minAge: number; today: Date }): Suggestion {
  if (o.next || (o.grade !== null && o.grade > o.last)) {
    return { suggested: true, reason: o.grade !== null && o.grade > o.last ? `tercatat kelas ${o.grade}` : "sekolah tercatat jenjang berikutnya" };
  }
  if (o.grade !== null && o.grade < o.last) return { suggested: false, reason: `tercatat kelas ${o.grade}` };
  if (o.grade === o.last) {
    return isPromotionSeason(o.today)
      ? { suggested: true, reason: `tercatat kelas ${o.last}, awal tahun ajaran` }
      : { suggested: false, reason: `masih kelas ${o.last} (naik Juli)` };
  }
  return { suggested: o.age >= o.minAge, reason: `usia ${o.age} per 1 Juli` };
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
 * Caberawit SD → Pra Remaja: sama, dengan kelas 6 sebagai kelas akhir (SMP/MTs atau
 * kelas 7+ → ya; kelas 1–5 → tidak); tanpa keterangan → usia ≥ 12.
 * Caberawit PAUD/TK → SD: tercatat SD/MI atau kelas → ya; masih PAUD/TK di luar
 * Juli–Agustus → tidak; tanpa keterangan → usia ≥ 6.
 * Balita → PAUD/TK: tercatat PAUD/TK/KB/RA → ya; tanpa keterangan → usia ≥ 4.
 *
 * Pelajar → Mandiri: tercatat lulus / semester akhir, atau usia ≥ 23; masih SMA (kelas
 * 10–12) tidak disarankan.
 */
export function suggestPromotion(key: TransitionKey, g: { birthDate: string; school: string | null }, today: Date): Suggestion {
  const age = ageAt(g.birthDate, academicYearStart(today));
  const school = g.school ?? "";
  const grade = gradeFromSchool(school);
  const ageText = `usia ${age} per 1 Juli`;

  switch (key) {
    case "balita-ke-paud":
      if (isPreschool(school) || isElementary(school)) return { suggested: true, reason: "tercatat sekolah" };
      return { suggested: age >= 4, reason: ageText };
    case "paud-ke-sd":
      if (isElementary(school) || grade !== null) return { suggested: true, reason: grade !== null ? `tercatat kelas ${grade}` : "tercatat SD/MI" };
      if (isPreschool(school) && !isPromotionSeason(today)) return { suggested: false, reason: "masih PAUD/TK (naik Juli)" };
      return { suggested: age >= 6, reason: ageText };
    case "sd-ke-pra":
      return byGrade({ grade, next: isLowerSecondary(school) || isUpperSchool(school), last: 6, age, minAge: 12, today });
    case "pelajar-ke-mandiri":
      if (/\blulus\b/i.test(school)) return { suggested: true, reason: "tercatat lulus" };
      if (/semester\s*(8|9|1[0-4])\b/i.test(school)) return { suggested: true, reason: "kuliah semester akhir" };
      if (grade !== null && grade >= 10) return { suggested: false, reason: `masih kelas ${grade}` };
      return { suggested: age >= 23, reason: ageText };
    default:
      return byGrade({ grade, next: isUpperSchool(school), last: 9, age, minAge: 15, today });
  }
}
