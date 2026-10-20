/**
 * Posisi Al-Qur'an untuk lintasan kitab berunit `ayat`: disimpan sebagai nomor
 * ayat urut mushaf (1 = Al-Fatihah 1, 6236 = An-Nas 6), ditampilkan surat:ayat.
 */

/** Nama surat (transliterasi umum di Indonesia) dan jumlah ayatnya, urut mushaf. */
export const SURAH: readonly { name: string; ayat: number }[] = [
  ["Al-Fatihah", 7], ["Al-Baqarah", 286], ["Ali 'Imran", 200], ["An-Nisa'", 176], ["Al-Ma'idah", 120],
  ["Al-An'am", 165], ["Al-A'raf", 206], ["Al-Anfal", 75], ["At-Taubah", 129], ["Yunus", 109],
  ["Hud", 123], ["Yusuf", 111], ["Ar-Ra'd", 43], ["Ibrahim", 52], ["Al-Hijr", 99],
  ["An-Nahl", 128], ["Al-Isra'", 111], ["Al-Kahf", 110], ["Maryam", 98], ["Taha", 135],
  ["Al-Anbiya'", 112], ["Al-Hajj", 78], ["Al-Mu'minun", 118], ["An-Nur", 64], ["Al-Furqan", 77],
  ["Asy-Syu'ara'", 227], ["An-Naml", 93], ["Al-Qasas", 88], ["Al-'Ankabut", 69], ["Ar-Rum", 60],
  ["Luqman", 34], ["As-Sajdah", 30], ["Al-Ahzab", 73], ["Saba'", 54], ["Fatir", 45],
  ["Yasin", 83], ["As-Saffat", 182], ["Sad", 88], ["Az-Zumar", 75], ["Gafir", 85],
  ["Fussilat", 54], ["Asy-Syura", 53], ["Az-Zukhruf", 89], ["Ad-Dukhan", 59], ["Al-Jasiyah", 37],
  ["Al-Ahqaf", 35], ["Muhammad", 38], ["Al-Fath", 29], ["Al-Hujurat", 18], ["Qaf", 45],
  ["Az-Zariyat", 60], ["At-Tur", 49], ["An-Najm", 62], ["Al-Qamar", 55], ["Ar-Rahman", 78],
  ["Al-Waqi'ah", 96], ["Al-Hadid", 29], ["Al-Mujadilah", 22], ["Al-Hasyr", 24], ["Al-Mumtahanah", 13],
  ["As-Saff", 14], ["Al-Jumu'ah", 11], ["Al-Munafiqun", 11], ["At-Tagabun", 18], ["At-Talaq", 12],
  ["At-Tahrim", 12], ["Al-Mulk", 30], ["Al-Qalam", 52], ["Al-Haqqah", 52], ["Al-Ma'arij", 44],
  ["Nuh", 28], ["Al-Jinn", 28], ["Al-Muzzammil", 20], ["Al-Muddassir", 56], ["Al-Qiyamah", 40],
  ["Al-Insan", 31], ["Al-Mursalat", 50], ["An-Naba'", 40], ["An-Nazi'at", 46], ["'Abasa", 42],
  ["At-Takwir", 29], ["Al-Infitar", 19], ["Al-Mutaffifin", 36], ["Al-Insyiqaq", 25], ["Al-Buruj", 22],
  ["At-Tariq", 17], ["Al-A'la", 19], ["Al-Gasyiyah", 26], ["Al-Fajr", 30], ["Al-Balad", 20],
  ["Asy-Syams", 15], ["Al-Lail", 21], ["Ad-Duha", 11], ["Asy-Syarh", 8], ["At-Tin", 8],
  ["Al-'Alaq", 19], ["Al-Qadr", 5], ["Al-Bayyinah", 8], ["Az-Zalzalah", 8], ["Al-'Adiyat", 11],
  ["Al-Qari'ah", 11], ["At-Takasur", 8], ["Al-'Asr", 3], ["Al-Humazah", 9], ["Al-Fil", 5],
  ["Quraisy", 4], ["Al-Ma'un", 7], ["Al-Kausar", 3], ["Al-Kafirun", 6], ["An-Nasr", 3],
  ["Al-Lahab", 5], ["Al-Ikhlas", 4], ["Al-Falaq", 5], ["An-Nas", 6],
].map(([name, ayat]) => ({ name: name as string, ayat: ayat as number }));

export const TOTAL_AYAT = 6236;

/** offset[i] = jumlah ayat sebelum surat ke-(i+1). */
const OFFSET = SURAH.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 0 : acc[i - 1] + SURAH[i - 1].ayat], []);

/** Awal tiap juz (mushaf Madinah), sebagai [surat, ayat]. */
const JUZ_START: readonly [number, number][] = [
  [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41],
  [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56],
  [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
];

export interface AyatRef {
  surah: number;
  ayat: number;
}

/** surat:ayat → nomor ayat urut (1–6236). Melempar galat bila di luar batas. */
export function toIndex(surah: number, ayat: number): number {
  const s = SURAH[surah - 1];
  if (!Number.isInteger(surah) || !s) throw new RangeError(`Surat ke-${surah} tidak ada`);
  if (!Number.isInteger(ayat) || ayat < 1 || ayat > s.ayat) {
    throw new RangeError(`${s.name} hanya ${s.ayat} ayat`);
  }
  return OFFSET[surah - 1] + ayat;
}

/** Nomor ayat urut → surat:ayat. */
export function fromIndex(index: number): AyatRef {
  if (!Number.isInteger(index) || index < 1 || index > TOTAL_AYAT) {
    throw new RangeError(`Nomor ayat harus 1–${TOTAL_AYAT}`);
  }
  let lo = 0;
  let hi = SURAH.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (OFFSET[mid] < index) lo = mid;
    else hi = mid - 1;
  }
  return { surah: lo + 1, ayat: index - OFFSET[lo] };
}

/** Juz (1–30) tempat ayat ini berada. */
export function juzOf(index: number): number {
  let juz = 1;
  for (let i = 0; i < JUZ_START.length; i++) {
    if (toIndex(...JUZ_START[i]) <= index) juz = i + 1;
    else break;
  }
  return juz;
}

/** mis. 256 → "Al-Baqarah 249". */
export function formatAyat(index: number): string {
  const { surah, ayat } = fromIndex(index);
  return `${SURAH[surah - 1].name} ${ayat}`;
}

/** Rentang target, mis. "Al-Baqarah 253 – Ali 'Imran 91". */
export function formatAyatRange(from: number, to: number): string {
  return from === to ? formatAyat(from) : `${formatAyat(from)} – ${formatAyat(to)}`;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/^(surat|surah|qs\.?)\s+/, "")
    .replace(/[^a-z]/g, "")
    .replace(/o/g, "a")
    .replace(/e/g, "i");

const BY_NAME = new Map(SURAH.map((s, i) => [normalize(s.name), i + 1]));

/**
 * Baca posisi dari teks: "2:253", "2 253", "Al-Baqarah 253", "Ali Imron 91".
 * Ejaan nama dilonggarkan (tanda baca, o→a, e→i). Mengembalikan null bila tidak dikenali.
 */
export function parseAyat(text: string): number | null {
  const t = text.trim();
  const numeric = t.match(/^(\d{1,3})\s*[: ]\s*(\d{1,3})$/);
  const named = t.match(/^(.*?)[\s:]+(\d{1,3})$/);
  let surah: number | undefined;
  let ayat: number | undefined;
  if (numeric) {
    surah = Number(numeric[1]);
    ayat = Number(numeric[2]);
  } else if (named) {
    surah = BY_NAME.get(normalize(named[1]));
    ayat = Number(named[2]);
  }
  if (!surah || !ayat) return null;
  try {
    return toIndex(surah, ayat);
  } catch {
    return null;
  }
}
