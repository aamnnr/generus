import { describe, expect, it } from "vitest";
import { formatPosition, formatRange, juzLabel, kitabStatus, parsePosition, percent, positionInput } from "@/lib/kurikulum-format";
import { toIndex } from "@/lib/quran";

describe("kurikulum-format", () => {
  it("memformat posisi & rentang", () => {
    expect(formatPosition("ayat", toIndex(2, 253))).toBe("Al-Baqarah 253");
    expect(formatPosition("halaman", 26)).toBe("hal 26");
    expect(formatRange("ayat", toIndex(2, 253), toIndex(3, 91))).toBe("Al-Baqarah 253 s.d. Ali 'Imran 91");
    expect(formatRange("halaman", 26, 38)).toBe("hal 26–38");
    expect(formatRange("bab", 3, 3)).toBe("bab 3");
    expect(juzLabel(toIndex(2, 253), toIndex(3, 91))).toBe("Juz 3");
    expect(juzLabel(toIndex(2, 253), toIndex(3, 100))).toBe("Juz 3–4");
  });

  it("membaca isian posisi dalam batas kitab", () => {
    expect(parsePosition("ayat", "Ali Imron 91", 6236)).toBe(toIndex(3, 91));
    expect(parsePosition("halaman", "26", 100)).toBe(26);
    expect(parsePosition("halaman", "101", 100)).toBeNull();
    expect(parsePosition("halaman", "hal 3", 100)).toBeNull();
    expect(parsePosition("ayat", "", 6236)).toBeNull();
    expect(positionInput("ayat", toIndex(7, 144))).toBe("Al-A'raf 144");
    expect(positionInput("bab", 4)).toBe("4");
    expect(positionInput("bab", null)).toBe("");
  });
});

describe("kitabStatus", () => {
  it("membandingkan posisi dengan rentang target", () => {
    expect(kitabStatus(null, 10, 20)).toBe("belum");
    expect(kitabStatus(9, 10, 20)).toBe("belum");
    expect(kitabStatus(10, 10, 20)).toBe("proses");
    expect(kitabStatus(19, 10, 20)).toBe("proses");
    expect(kitabStatus(20, 10, 20)).toBe("tuntas");
    expect(kitabStatus(300, 10, 20)).toBe("tuntas");
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBe(0);
  });
});
