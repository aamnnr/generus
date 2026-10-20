import { describe, expect, it } from "vitest";
import { formatAyat, formatAyatRange, fromIndex, juzOf, parseAyat, SURAH, toIndex, TOTAL_AYAT } from "@/lib/quran";

describe("quran", () => {
  it("114 surat berjumlah 6236 ayat", () => {
    expect(SURAH).toHaveLength(114);
    expect(SURAH.reduce((s, x) => s + x.ayat, 0)).toBe(TOTAL_AYAT);
  });

  it("konversi bolak-balik untuk semua ayat", () => {
    for (let i = 1; i <= TOTAL_AYAT; i++) {
      const { surah, ayat } = fromIndex(i);
      expect(toIndex(surah, ayat)).toBe(i);
    }
    expect(toIndex(1, 1)).toBe(1);
    expect(toIndex(114, 6)).toBe(6236);
    expect(toIndex(2, 1)).toBe(8);
  });

  it("menolak posisi di luar batas", () => {
    expect(() => toIndex(1, 8)).toThrow(/7 ayat/);
    expect(() => toIndex(115, 1)).toThrow();
    expect(() => fromIndex(0)).toThrow();
    expect(() => fromIndex(6237)).toThrow();
  });

  it("menampilkan rentang target seperti dokumen PPG", () => {
    expect(formatAyatRange(toIndex(2, 253), toIndex(3, 91))).toBe("Al-Baqarah 253 – Ali 'Imran 91");
    expect(formatAyat(toIndex(7, 144))).toBe("Al-A'raf 144");
  });

  it("menentukan juz", () => {
    expect(juzOf(1)).toBe(1);
    expect(juzOf(toIndex(2, 252))).toBe(2);
    expect(juzOf(toIndex(2, 253))).toBe(3);
    expect(juzOf(toIndex(7, 144))).toBe(9);
    expect(juzOf(TOTAL_AYAT)).toBe(30);
  });

  it("membaca teks posisi dengan ejaan longgar", () => {
    expect(parseAyat("2:253")).toBe(toIndex(2, 253));
    expect(parseAyat("Al-Baqarah 253")).toBe(toIndex(2, 253));
    expect(parseAyat("al baqarah 253")).toBe(toIndex(2, 253));
    expect(parseAyat("Ali Imron 91")).toBe(toIndex(3, 91));
    expect(parseAyat("Surat An-Naba' 40")).toBe(toIndex(78, 40));
    expect(parseAyat("An-Nas 6")).toBe(6236);
    expect(parseAyat("An-Nisa 176")).toBe(toIndex(4, 176));
    expect(parseAyat("Al-Fatihah 8")).toBeNull();
    expect(parseAyat("bukan surat 3")).toBeNull();
  });

  it("nama surat tidak bertabrakan setelah dinormalkan", () => {
    for (let i = 0; i < SURAH.length; i++) {
      expect(parseAyat(`${SURAH[i].name} 1`)).toBe(toIndex(i + 1, 1));
    }
  });
});
