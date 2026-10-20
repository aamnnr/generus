import { describe, expect, it } from "vitest";
import { academicYearStart, ageAt, isPromotionSeason, isSuggested } from "@/lib/kenaikan-rules";

const juli = new Date(2026, 6, 15);

describe("kalender tahun ajaran", () => {
  it("awal tahun ajaran = 1 Juli tahun berjalan (Juli–Des) atau tahun lalu (Jan–Jun)", () => {
    expect(academicYearStart(juli)).toEqual(new Date(2026, 6, 1));
    expect(academicYearStart(new Date(2027, 2, 1))).toEqual(new Date(2026, 6, 1));
  });
  it("pengingat hanya Juli–Agustus", () => {
    expect(isPromotionSeason(juli)).toBe(true);
    expect(isPromotionSeason(new Date(2026, 7, 31))).toBe(true);
    expect(isPromotionSeason(new Date(2026, 8, 1))).toBe(false);
  });
  it("usia dihitung tepat di hari ulang tahun", () => {
    expect(ageAt("2011-07-01", new Date(2026, 6, 1))).toBe(15);
    expect(ageAt("2011-07-02", new Date(2026, 6, 1))).toBe(14);
  });
});

describe("isSuggested", () => {
  it("Pra Remaja: usia ≥ 15 per 1 Juli, atau tercatat kelas 9", () => {
    expect(isSuggested("pra-ke-pelajar", { birthDate: "2011-06-30", school: null }, juli)).toBe(true);
    expect(isSuggested("pra-ke-pelajar", { birthDate: "2012-01-01", school: "SMP 3 kelas 8" }, juli)).toBe(false);
    expect(isSuggested("pra-ke-mandiri", { birthDate: "2012-01-01", school: "SMPN 1 Kelas 9" }, juli)).toBe(true);
  });
  it("Pelajar → Mandiri: usia ≥ 23, lulus, atau semester akhir", () => {
    expect(isSuggested("pelajar-ke-mandiri", { birthDate: "2003-01-01", school: null }, juli)).toBe(true);
    expect(isSuggested("pelajar-ke-mandiri", { birthDate: "2007-01-01", school: "SMA 2 kelas 12" }, juli)).toBe(false);
    expect(isSuggested("pelajar-ke-mandiri", { birthDate: "2004-05-05", school: "Kuliah semester 8" }, juli)).toBe(true);
    expect(isSuggested("pelajar-ke-mandiri", { birthDate: "2005-05-05", school: "Kuliah semester 3" }, juli)).toBe(false);
  });
});
