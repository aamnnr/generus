import { describe, expect, it } from "vitest";
import { academicYearStart, ageAt, gradeFromSchool, isPromotionSeason, suggestPromotion, type TransitionKey } from "@/lib/kenaikan-rules";

const isSuggested = (k: TransitionKey, g: { birthDate: string; school: string | null }, d: Date) => suggestPromotion(k, g, d).suggested;

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

describe("kelas dari kolom sekolah", () => {
  it("mengenali kelas, kls, romawi, dan rombel", () => {
    expect(gradeFromSchool("SMPN 2 kelas 8")).toBe(8);
    expect(gradeFromSchool("SMP 1 Trucuk kls 9")).toBe(9);
    expect(gradeFromSchool("SMP N 3 Kelas VII")).toBe(7);
    expect(gradeFromSchool("SMPN 1 Cawas 9A")).toBe(9);
    expect(gradeFromSchool("SMP Muh IX B")).toBe(9);
  });
  it("nomor sekolah bukan kelas", () => {
    expect(gradeFromSchool("SMP N 9 Klaten")).toBeNull();
    expect(gradeFromSchool("SMP N 2 Cawas")).toBeNull();
    expect(gradeFromSchool(null)).toBeNull();
  });
});

describe("Pra Remaja: hanya yang lulus kelas 9 yang naik", () => {
  const nov = new Date(2026, 10, 9);
  const s = (school: string | null, birthDate = "2011-03-01", d = juli) => suggestPromotion("pra-ke-pelajar", { birthDate, school }, d);
  it("kelas 7 dan 8 tidak disarankan walau usianya sudah 15", () => {
    expect(s("SMPN 1 kelas 7")).toEqual({ suggested: false, reason: "tercatat kelas 7" });
    expect(s("SMPN 1 kelas 8").suggested).toBe(false);
  });
  it("kelas 9: disarankan di awal tahun ajaran (baru lulus), tidak di tengah tahun (masih duduk di kelas 9)", () => {
    expect(s("SMPN 1 kelas 9", "2012-01-01", juli).suggested).toBe(true);
    expect(s("SMPN 1 kelas 9", "2011-03-01", nov)).toEqual({ suggested: false, reason: "masih kelas 9 (naik Juli)" });
  });
  it("sudah tercatat SMA/SMK/MA atau kelas 10 → disarankan", () => {
    expect(s("SMA N 1 Cawas", "2012-01-01").suggested).toBe(true);
    expect(s("SMK Muh 2 Klaten", "2012-01-01").suggested).toBe(true);
    expect(s("SMA/K N 1 Pedan", "2012-01-01").suggested).toBe(true);
    expect(s("kelas 10", "2012-01-01").suggested).toBe(true);
    expect(s("MTs N 1 Klaten", "2012-01-01").suggested).toBe(false);
  });
  it("tanpa keterangan kelas → berdasarkan usia per 1 Juli", () => {
    expect(s("SMP N 2 Cawas", "2011-06-30")).toEqual({ suggested: true, reason: "usia 15 per 1 Juli" });
    expect(s(null, "2011-07-02").suggested).toBe(false);
  });
});

describe("Pelajar → Mandiri", () => {
  it("masih SMA tidak disarankan walau usia sudah lewat", () => {
    expect(suggestPromotion("pelajar-ke-mandiri", { birthDate: "2002-01-01", school: "SMK kelas 12" }, juli)).toEqual({ suggested: false, reason: "masih kelas 12" });
  });
});
