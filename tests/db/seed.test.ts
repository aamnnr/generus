import { describe, expect, it } from "vitest";
import { generateSeedData } from "../../scripts/seed/generate";
import { insertSeed, type Query } from "../../scripts/seed/insert";
import { insertKurikulum } from "../../scripts/seed/kurikulum";
import { insertPresensiSample } from "../../scripts/seed/presensi";
import { KURIKULUM_OKTOBER_2026 } from "../../scripts/seed/kurikulum-data";
import { formatAyatRange } from "@/lib/quran";
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

describe("insertKurikulum", () => {
  it("mengisi periode Oktober 2026 dan aman dijalankan ulang", async () => {
    const db = await createTestDb();
    const q: Query = async (sql, params) => (await db.query(sql, params)).rows as never;

    const first = await insertKurikulum(q, KURIKULUM_OKTOBER_2026);
    expect(first.skipped).toBe(false);
    expect(first.targets).toBe(KURIKULUM_OKTOBER_2026.targets.length);
    expect((await insertKurikulum(q, KURIKULUM_OKTOBER_2026)).skipped).toBe(true);

    const again = await insertKurikulum(q, KURIKULUM_OKTOBER_2026, { reset: true });
    expect(again.periodId).not.toBe(first.periodId);
    const [{ periods, targets, materi }] = await q<{ periods: number; targets: number; materi: number }>(
      `SELECT (SELECT count(*)::int FROM curriculum_periods) periods,
              (SELECT count(*)::int FROM period_targets) targets,
              (SELECT count(*)::int FROM materi) materi`,
    );
    expect(periods).toBe(1);
    expect(targets).toBe(KURIKULUM_OKTOBER_2026.targets.length);
    expect(materi).toBe(KURIKULUM_OKTOBER_2026.targets.filter((t) => t.materi).length);

    const [bacaan] = await q<{ range_from: number; range_to: number }>(
      `SELECT range_from, range_to FROM period_targets WHERE mapel = 'Bacaan'`,
    );
    expect(formatAyatRange(bacaan.range_from, bacaan.range_to)).toBe("Al-Baqarah 253 – Ali 'Imran 91");
  });
});

describe("insertPresensiSample", () => {
  it("membuat agenda mingguan terkunci beserta presensi, dan bisa diulang", async () => {
    const db = await createTestDb();
    const q: Query = async (sql, params) => (await db.query(sql, params)).rows as never;
    await insertSeed(q, generateSeedData({ desaCount: 1, kelompokPerDesa: 2, generusPerKelompok: 10 }));
    const res = await insertPresensiSample(q, { today: "2026-10-20" });
    const [{ aktif }] = await q<{ aktif: number }>(`SELECT count(*)::int AS aktif FROM generus WHERE status = 'aktif'`);
    // 2 kelompok × 8 pekan; tiap generus aktif tercatat di 8 agenda kelompoknya.
    expect(res).toMatchObject({ skipped: false, agendas: 16, attendance: aktif * 8 });
    expect((await insertPresensiSample(q, { today: "2026-10-20" })).skipped).toBe(true);
    const [{ open, last }] = await q<{ open: number; last: string }>(
      `SELECT count(*) FILTER (WHERE locked_at IS NULL)::int AS open, max(starts_at AT TIME ZONE 'Asia/Jakarta')::text AS last FROM agendas`,
    );
    expect(open).toBe(0);
    expect(last).toBe("2026-10-18 19:30:00");
    expect((await insertPresensiSample(q, { reset: true, today: "2026-10-20" })).attendance).toBe(aktif * 8);
  });
});
