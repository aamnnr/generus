import { describe, expect, it } from "vitest";
import { generateSeedData } from "../../scripts/seed/generate";
import { insertSeed, type Query } from "../../scripts/seed/insert";
import { createTestDb } from "./harness";

describe("generateSeedData", () => {
  it("deterministik untuk benih yang sama", () => {
    const a = generateSeedData({ desaCount: 2, kelompokPerDesa: 2, generusPerKelompok: 10 });
    const b = generateSeedData({ desaCount: 2, kelompokPerDesa: 2, generusPerKelompok: 10 });
    expect(a).toEqual(b);
  });

  it("mematuhi aturan jenjang & kategori", () => {
    const data = generateSeedData();
    const all = data.desa.flatMap((d) => d.kelompok.flatMap((k) => k.generus));
    expect(data.desa).toHaveLength(10);
    expect(data.desa.every((d) => d.kelompok.length === 6)).toBe(true);
    expect(all.length).toBeGreaterThan(4000);
    expect(all.length).toBeLessThan(6500);
    for (const g of all) {
      if (g.jenjang === "Pra Remaja") expect(g.kategori).toBeNull();
      else expect(["Pelajar", "Mandiri"]).toContain(g.kategori);
    }
  });
});

describe("insertSeed", () => {
  it("menulis data skala penuh ke database hasil migrasi", async () => {
    const db = await createTestDb();
    const q: Query = async (sql, params) => (await db.query(sql, params)).rows as never;

    const res = await insertSeed(q, generateSeedData());
    const [{ n }] = await q<{ n: number }>(`SELECT count(*)::int AS n FROM generus`);
    expect(n).toBe(res.counts.generus);

    const [{ inside }] = await q<{ inside: number }>(
      `SELECT count(*)::int AS inside FROM generus g JOIN units d ON d.id = $1 WHERE g.unit_path <@ d.path`,
      [res.unitIds.firstDesa],
    );
    const firstDesaTotal = generateSeedData().desa[0].kelompok.reduce((s, k) => s + k.generus.length, 0);
    expect(inside).toBe(firstDesaTotal);
  }, 120_000);
});
