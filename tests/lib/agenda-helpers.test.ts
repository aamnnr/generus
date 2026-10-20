import { describe, expect, it } from "vitest";
import { segmentsOf, segmentsToTarget, targetLabel, targetToSegments, type JenjangRef } from "@/lib/agenda-target";
import { utcToZoned, zonedToUtc } from "@/lib/time";

const jenjang: JenjangRef[] = [
  { id: "pr", name: "Pra Remaja", kategori: [] },
  { id: "r", name: "Remaja", kategori: [{ id: "pel", name: "Pelajar" }, { id: "man", name: "Mandiri" }] },
];
const [PR, PEL, MAN] = segmentsOf(jenjang).map((s) => s.key);

describe("sasaran agenda", () => {
  it("segmen: Pra Remaja, Remaja Pelajar, Remaja Mandiri", () => {
    expect(segmentsOf(jenjang).map((s) => s.label)).toEqual(["Pra Remaja", "Remaja Pelajar", "Remaja Mandiri"]);
  });

  it.each([
    [[PR, PEL, MAN], [], []],
    [[], [], []],
    [[PR], ["pr"], []],
    [[PEL, MAN], ["r"], []],
    [[PR, PEL], ["pr", "r"], ["pel"]],
    [[MAN], ["r"], ["man"]],
  ])("%j → jenjang %j kategori %j, dan kembali lagi", (keys, jenjangIds, kategoriIds) => {
    const t = segmentsToTarget(keys, jenjang);
    expect(t).toEqual({ jenjangIds, kategoriIds });
    const expected = keys.length === 0 ? [PR, PEL, MAN] : keys;
    expect(targetToSegments(t, jenjang).sort()).toEqual([...expected].sort());
  });

  it("label sasaran", () => {
    expect(targetLabel({ jenjangIds: [], kategoriIds: [], gender: null }, jenjang)).toBe("Semua jenjang");
    expect(targetLabel({ jenjangIds: ["pr", "r"], kategoriIds: ["pel"], gender: "P" }, jenjang)).toBe("Pra Remaja, Remaja Pelajar · Perempuan");
  });
});

describe("zona waktu", () => {
  it("WIB (UTC+7) bolak-balik", () => {
    const d = zonedToUtc("2026-10-25", "19:30", "Asia/Jakarta");
    expect(d.toISOString()).toBe("2026-10-25T12:30:00.000Z");
    expect(utcToZoned(d, "Asia/Jakarta")).toEqual({ date: "2026-10-25", time: "19:30" });
  });
  it("WITA dan lewat tengah malam UTC", () => {
    expect(zonedToUtc("2026-01-01", "05:00", "Asia/Makassar").toISOString()).toBe("2025-12-31T21:00:00.000Z");
  });
});
