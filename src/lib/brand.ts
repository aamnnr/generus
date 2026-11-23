// Merek aplikasi. Dipilih saat build lewat NEXT_PUBLIC_BRAND:
//   "kliik"   (bawaan) — KLIIK JM: navy #1A2189 + cyan #008CD7, logo dari klien (docs/brand/kliik-jm).
//   "generus"           — desain lama (hijau tua + kuningan, logo masjid & bintang).
// Kembali ke desain lama = set NEXT_PUBLIC_BRAND=generus lalu build/deploy ulang; tidak ada data yang berubah.
// Token warna per merek ada di globals.css (`:root.brand-kliik`).

export type Brand = "kliik" | "generus";

export const BRAND: Brand = process.env.NEXT_PUBLIC_BRAND === "generus" ? "generus" : "kliik";

const BRANDS = {
  kliik: {
    name: "KLIIK JM",
    fullName: "KLIIK JM — Klaten Timur II Kontrol Jurnal Mengaji",
    /** Warna bilah status HP & latar ikon. */
    color: "#1A2189",
  },
  generus: {
    name: "Generus",
    fullName: "Pantau Generus",
    color: "#1A4A39",
  },
} as const;

export const brand = BRANDS[BRAND];
export const isKliik = BRAND === "kliik";
