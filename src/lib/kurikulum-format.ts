// Label & format kurikulum yang aman dipakai di server maupun klien.
import { formatAyat, juzOf, parseAyat } from "@/lib/quran";

export type Aspek = "alim" | "faqih" | "akhlaq" | "mandiri";
export type KitabUnit = "ayat" | "halaman" | "bab";
export type AssessmentMode = "generus" | "kelompok";

export const ASPEK_ORDER: Aspek[] = ["alim", "faqih", "akhlaq", "mandiri"];

export const ASPEK_LABEL: Record<Aspek, string> = {
  alim: "Alim",
  faqih: "Faqih",
  akhlaq: "Akhlaqul Karimah",
  mandiri: "Mandiri",
};

export const KITAB_UNIT_LABEL: Record<KitabUnit, string> = {
  ayat: "Ayat Al-Qur'an",
  halaman: "Halaman",
  bab: "Bab",
};

export const ASSESSMENT_LABEL: Record<AssessmentMode, string> = {
  generus: "Dinilai per generus",
  kelompok: "Ditandai per kelompok",
};

/** Posisi kitab untuk ditampilkan: "Al-Baqarah 253", "hal 26", "bab 3". */
export function formatPosition(unit: KitabUnit, position: number): string {
  if (unit === "ayat") return formatAyat(position);
  return `${unit === "halaman" ? "hal" : "bab"} ${position}`;
}

/** Rentang target, mis. "Al-Baqarah 253 s.d. Ali 'Imran 91" atau "hal 26–38". */
export function formatRange(unit: KitabUnit, from: number, to: number): string {
  if (unit === "ayat") return from === to ? formatAyat(from) : `${formatAyat(from)} s.d. ${formatAyat(to)}`;
  const label = unit === "halaman" ? "hal" : "bab";
  return from === to ? `${label} ${from}` : `${label} ${from}–${to}`;
}

/** Juz yang dicakup rentang ayat, mis. "Juz 3" atau "Juz 3–4". */
export function juzLabel(from: number, to: number): string {
  const a = juzOf(from);
  const b = juzOf(to);
  return a === b ? `Juz ${a}` : `Juz ${a}–${b}`;
}

/** Baca isian posisi: ayat ("Al-Baqarah 253" / "2:253") atau angka halaman/bab. */
export function parsePosition(unit: KitabUnit, text: string, total: number): number | null {
  const t = text.trim();
  if (!t) return null;
  const n = unit === "ayat" ? parseAyat(t) : /^\d+$/.test(t) ? Number(t) : null;
  return n !== null && n >= 1 && n <= total ? n : null;
}

/** Nilai awal isian posisi (kebalikan parsePosition). */
export function positionInput(unit: KitabUnit, position: number | null | undefined): string {
  if (position == null) return "";
  return unit === "ayat" ? formatAyat(position) : String(position);
}
