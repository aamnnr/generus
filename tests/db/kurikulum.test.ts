import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, createUnit, createUser, grantRole } from "./harness";

let db: PGlite;
const u = {} as Record<"superadmin" | "kurikulum" | "adminDesaA" | "adminKelA1" | "kyaiKelA1" | "adminKelB1", string>;
const unit = {} as Record<"daerah" | "desaA" | "desaB" | "kelA1" | "kelB1", string>;
const j = {} as Record<"pra" | "remaja" | "pelajar" | "mandiri", string>;
const g = {} as Record<string, string>;
const m = {} as Record<"hafalan" | "akhlaq", string>;
let quran = "";
let period = "";
let draft = "";
const t = {} as Record<"hafalan" | "hafalanPutri" | "akhlaq" | "bacaan" | "draftHafalan", string>;

const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

async function addGenerus(key: string, kelompokId: string, opts: { jenjang?: "pra" | "pelajar" | "mandiri"; gender?: "L" | "P" } = {}) {
  const jenjang = opts.jenjang ?? "pelajar";
  const r = await one<{ id: string }>(
    `INSERT INTO generus (kelompok_id, name, gender, birth_date, jenjang_id, kategori_id)
     VALUES ($1, $2, $3, '2010-01-01', $4, $5) RETURNING id`,
    [kelompokId, key, opts.gender ?? "L", jenjang === "pra" ? j.pra : j.remaja, jenjang === "pra" ? null : j[jenjang]],
  );
  g[key] = r.id;
}

const as = <T>(user: keyof typeof u, fn: () => Promise<T>) => asUser(db, u[user], fn);
const count = async (sql: string, params: unknown[] = []) => (await one<{ n: number }>(`SELECT count(*)::int AS n FROM (${sql}) x`, params)).n;

async function addTarget(periodId: string, fields: Record<string, unknown>) {
  const row: Record<string, unknown> = { period_id: periodId, jenjang_id: j.remaja, aspek: "alim", mapel: "Hafalan", ...fields };
  const cols = Object.keys(row);
  const vals = Object.values(row);
  const r = await one<{ id: string }>(
    `INSERT INTO period_targets (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`,
    vals,
  );
  return r.id;
}

const setAchievement = (user: keyof typeof u, targetId: string, generusId: string, status = "tuntas") =>
  as(user, () =>
    db.query(
      `INSERT INTO achievements (target_id, generus_id, status) VALUES ($1, $2, $3)
       ON CONFLICT (target_id, generus_id) DO UPDATE SET status = EXCLUDED.status`,
      [targetId, generusId, status],
    ),
  );

beforeAll(async () => {
  db = await createTestDb();
  unit.daerah = await createUnit(db, "daerah", "Daerah", null);
  unit.desaA = await createUnit(db, "desa", "Desa A", unit.daerah);
  unit.desaB = await createUnit(db, "desa", "Desa B", unit.daerah);
  unit.kelA1 = await createUnit(db, "kelompok", "A1", unit.desaA);
  unit.kelB1 = await createUnit(db, "kelompok", "B1", unit.desaB);

  for (const k of ["superadmin", "kurikulum", "adminDesaA", "adminKelA1", "kyaiKelA1", "adminKelB1"] as const) {
    u[k] = await createUser(db, `kur-${k}`);
  }
  await grantRole(db, u.superadmin, unit.daerah, "superadmin");
  await grantRole(db, u.kurikulum, unit.daerah, "kurikulum");
  await grantRole(db, u.adminDesaA, unit.desaA, "admin");
  await grantRole(db, u.adminKelA1, unit.kelA1, "admin");
  await grantRole(db, u.kyaiKelA1, unit.kelA1, "kyai");
  await grantRole(db, u.adminKelB1, unit.kelB1, "admin");

  const rows = (await db.query<{ jn: string; jid: string; kn: string | null; kid: string | null }>(
    `SELECT j.name jn, j.id jid, k.name kn, k.id kid FROM jenjang j LEFT JOIN jenjang_kategori k ON k.jenjang_id = j.id`,
  )).rows;
  j.pra = rows.find((r) => r.jn === "Pra Remaja")!.jid;
  j.remaja = rows.find((r) => r.jn === "Remaja")!.jid;
  j.pelajar = rows.find((r) => r.kn === "Pelajar")!.kid!;
  j.mandiri = rows.find((r) => r.kn === "Mandiri")!.kid!;
  quran = (await one<{ id: string }>(`SELECT id FROM kitab WHERE title = 'Bacaan Al-Qur''an'`)).id;

  await addGenerus("a1-putra", unit.kelA1);
  await addGenerus("a1-putri", unit.kelA1, { gender: "P", jenjang: "mandiri" });
  await addGenerus("a1-pra", unit.kelA1, { jenjang: "pra" });
  await addGenerus("b1-putra", unit.kelB1);

  // Disusun oleh tim kurikulum lewat RLS.
  await as("kurikulum", async () => {
    m.hafalan = (await one<{ id: string }>(
      `INSERT INTO materi (aspek, mapel, title) VALUES ('alim', 'Hafalan', 'Asmaul Husna 1–99') RETURNING id`,
    )).id;
    m.akhlaq = (await one<{ id: string }>(
      `INSERT INTO materi (aspek, mapel, title, assessment) VALUES ('akhlaq', 'Tata Krama', 'Menghormati guru', 'kelompok') RETURNING id`,
    )).id;
    period = (await one<{ id: string }>(
      `INSERT INTO curriculum_periods (name, semester, starts_on, ends_on) VALUES ('Oktober 2026', '1-2026', '2026-10-05', '2026-11-07') RETURNING id`,
    )).id;
    draft = (await one<{ id: string }>(
      `INSERT INTO curriculum_periods (name, semester, starts_on, ends_on) VALUES ('November 2026', '1-2026', '2026-11-08', '2026-12-05') RETURNING id`,
    )).id;
    t.hafalan = await addTarget(period, { materi_id: m.hafalan });
    t.hafalanPutri = await addTarget(period, { materi_id: m.hafalan, gender: "P", sort_order: 1 });
    t.akhlaq = await addTarget(period, { materi_id: m.akhlaq, aspek: "akhlaq", mapel: "Tata Krama" });
    t.bacaan = await addTarget(period, { kitab_id: quran, range_from: 2 + 253 + 5, range_to: 400, note: "Juz 3" });
    t.draftHafalan = await addTarget(draft, { materi_id: m.hafalan });
    await db.query(`UPDATE curriculum_periods SET published_at = now() WHERE id = $1`, [period]);
  });
});

describe("penyusunan kurikulum", () => {
  it("hanya tim kurikulum & superadmin yang boleh menulis materi, periode, target", async () => {
    for (const who of ["adminDesaA", "adminKelA1", "kyaiKelA1"] as const) {
      await expect(
        as(who, () => db.query(`INSERT INTO materi (aspek, mapel, title) VALUES ('alim', 'Hafalan', 'x-${who}')`)),
      ).rejects.toThrow(/row-level security/);
      await expect(
        as(who, () => db.query(`INSERT INTO curriculum_periods (name, semester, starts_on, ends_on) VALUES ($1, '1', '2026-01-01', '2026-01-31')`, [who])),
      ).rejects.toThrow(/row-level security/);
      // UPDATE tanpa hak tidak menyentuh baris apa pun.
      const r = await as(who, () => db.query(`UPDATE period_targets SET strategy = 'ubah' WHERE id = $1`, [t.hafalan]));
      expect(r.affectedRows).toBe(0);
    }
    await as("superadmin", () => db.query(`UPDATE materi SET body = 'oleh superadmin' WHERE id = $1`, [m.hafalan]));
  });

  it("periode draf hanya terlihat penyusun; target mengikuti periodenya", async () => {
    for (const who of ["adminKelA1", "kyaiKelA1", "adminDesaA"] as const) {
      expect(await as(who, () => count(`SELECT 1 FROM curriculum_periods`))).toBe(1);
      expect(await as(who, () => count(`SELECT 1 FROM period_targets WHERE period_id = $1`, [draft]))).toBe(0);
      expect(await as(who, () => count(`SELECT 1 FROM period_targets WHERE period_id = $1`, [period]))).toBe(4);
      expect(await as(who, () => count(`SELECT 1 FROM materi`))).toBe(2);
    }
    expect(await as("kurikulum", () => count(`SELECT 1 FROM curriculum_periods`))).toBe(2);
  });

  it("memvalidasi target: rentang kitab, kategori, jenis isi", async () => {
    await expect(as("kurikulum", () => addTarget(period, { kitab_id: quran, range_from: 6000, range_to: 7000 }))).rejects.toThrow(
      /melebihi isi kitab/,
    );
    await expect(as("kurikulum", () => addTarget(period, { kitab_id: quran, range_from: 50, range_to: 10 }))).rejects.toThrow(
      /period_targets_kind/,
    );
    await expect(as("kurikulum", () => addTarget(period, { materi_id: m.hafalan, kitab_id: quran, range_from: 1, range_to: 2 }))).rejects.toThrow(
      /period_targets_kind/,
    );
    await expect(
      as("kurikulum", () => addTarget(period, { materi_id: m.hafalan, jenjang_id: j.pra, kategori_id: j.pelajar })),
    ).rejects.toThrow(/Kategori tidak sesuai/);
  });
});

describe("capaian per generus", () => {
  it("admin kelompok & admin desa mengisi capaian generus dalam lingkupnya", async () => {
    await setAchievement("adminKelA1", t.hafalan, g["a1-putra"], "proses");
    await setAchievement("adminDesaA", t.hafalan, g["a1-putra"], "tuntas");
    const row = await one<{ status: string; updated_by: string }>(
      `SELECT status, updated_by FROM achievements WHERE target_id = $1 AND generus_id = $2`,
      [t.hafalan, g["a1-putra"]],
    );
    expect(row).toEqual({ status: "tuntas", updated_by: u.adminDesaA });
  });

  it("tidak boleh menulis generus kelompok lain; kyai & kurikulum tidak menulis", async () => {
    await expect(setAchievement("adminKelB1", t.hafalan, g["a1-putra"])).rejects.toThrow(/row-level security/);
    await expect(setAchievement("adminKelA1", t.hafalan, g["b1-putra"])).rejects.toThrow(/row-level security/);
    await expect(setAchievement("kyaiKelA1", t.hafalan, g["a1-putra"])).rejects.toThrow(/row-level security/);
    await expect(setAchievement("kurikulum", t.hafalan, g["a1-putra"])).rejects.toThrow(/row-level security/);
  });

  it("kyai kelompok membaca capaian kelompoknya, kelompok lain tidak", async () => {
    await setAchievement("adminKelB1", t.hafalan, g["b1-putra"]);
    expect(await as("kyaiKelA1", () => count(`SELECT 1 FROM achievements`))).toBe(1);
    expect(await as("adminKelB1", () => count(`SELECT 1 FROM achievements`))).toBe(1);
    expect(await as("kurikulum", () => count(`SELECT 1 FROM achievements`))).toBe(0);
  });

  it("menolak target yang tidak sesuai", async () => {
    await expect(setAchievement("adminKelA1", t.bacaan, g["a1-putra"])).rejects.toThrow(/progres kitab/);
    await expect(setAchievement("adminKelA1", t.akhlaq, g["a1-putra"])).rejects.toThrow(/per kelompok/);
    await expect(setAchievement("superadmin", t.draftHafalan, g["a1-putra"])).rejects.toThrow(/belum diterbitkan/);
    await expect(setAchievement("adminKelA1", t.hafalanPutri, g["a1-putra"])).rejects.toThrow(/bukan sasaran/);
    await expect(setAchievement("adminKelA1", t.hafalan, g["a1-pra"])).rejects.toThrow(/bukan sasaran/);
    await setAchievement("adminKelA1", t.hafalanPutri, g["a1-putri"]);
  });

  it("generus yang keluar sebelum periode bukan sasaran; yang keluar di tengah periode tetap", async () => {
    await addGenerus("a1-menikah-lama", unit.kelA1);
    await addGenerus("a1-menikah-baru", unit.kelA1);
    await db.query(`UPDATE generus SET status = 'menikah', status_date = '2026-09-01' WHERE id = $1`, [g["a1-menikah-lama"]]);
    await db.query(`UPDATE generus SET status = 'menikah', status_date = '2026-10-20' WHERE id = $1`, [g["a1-menikah-baru"]]);
    await expect(setAchievement("adminKelA1", t.hafalan, g["a1-menikah-lama"])).rejects.toThrow(/bukan sasaran/);
    await setAchievement("adminKelA1", t.hafalan, g["a1-menikah-baru"]);
  });

  it("target yang sudah punya capaian tidak bisa dihapus; perubahan tercatat di audit", async () => {
    await expect(as("kurikulum", () => db.query(`DELETE FROM period_targets WHERE id = $1`, [t.hafalan]))).rejects.toThrow(
      /foreign key/,
    );
    const audit = await count(`SELECT 1 FROM audit_log WHERE table_name = 'achievements' AND row_id = $1`, [t.hafalan]);
    expect(audit).toBeGreaterThanOrEqual(3);
  });
});

describe("penyampaian per kelompok", () => {
  const deliver = (user: keyof typeof u, targetId: string, kelompokId: string) =>
    as(user, () =>
      db.query(`INSERT INTO target_deliveries (target_id, kelompok_id, delivered_on) VALUES ($1, $2, '2026-10-12')`, [targetId, kelompokId]),
    );

  it("admin kelompok menandai kelompoknya; kyai kelompok bisa membaca", async () => {
    await deliver("adminKelA1", t.akhlaq, unit.kelA1);
    expect(await as("kyaiKelA1", () => count(`SELECT 1 FROM target_deliveries`))).toBe(1);
    expect(await as("adminKelB1", () => count(`SELECT 1 FROM target_deliveries`))).toBe(0);
    const r = await one<{ recorded_by: string }>(`SELECT recorded_by FROM target_deliveries WHERE target_id = $1`, [t.akhlaq]);
    expect(r.recorded_by).toBe(u.adminKelA1);
  });

  it("menolak kelompok lain, unit bukan kelompok, dan materi per generus", async () => {
    await expect(deliver("adminKelA1", t.akhlaq, unit.kelB1)).rejects.toThrow(/row-level security/);
    await expect(deliver("kyaiKelA1", t.akhlaq, unit.kelA1)).rejects.toThrow();
    await expect(deliver("adminDesaA", t.akhlaq, unit.desaA)).rejects.toThrow(/per kelompok/);
    await expect(deliver("adminKelB1", t.hafalan, unit.kelB1)).rejects.toThrow(/per generus/);
  });
});

describe("progres kitab", () => {
  const progress = (user: keyof typeof u, generusId: string, position: number, recordedOn = "2026-10-10") =>
    as(user, () =>
      db.query(`INSERT INTO kitab_progress (generus_id, kitab_id, position, recorded_on) VALUES ($1, $2, $3, $4)`, [
        generusId, quran, position, recordedOn,
      ]),
    );

  it("posisi terkini diambil dari catatan terbaru", async () => {
    await progress("adminKelA1", g["a1-putra"], 300, "2026-10-10");
    await progress("adminKelA1", g["a1-putra"], 320, "2026-10-17");
    await progress("adminKelA1", g["a1-putra"], 310, "2026-10-12"); // susulan, lebih lama
    const r = await as("kyaiKelA1", () =>
      one<{ position: number }>(`SELECT position FROM kitab_progress_latest WHERE generus_id = $1`, [g["a1-putra"]]),
    );
    expect(r.position).toBe(320);
    expect(await as("adminKelB1", () => count(`SELECT 1 FROM kitab_progress_latest`))).toBe(0);
  });

  it("menolak posisi di luar batas, tanggal masa depan, dan kelompok lain", async () => {
    await expect(progress("adminKelA1", g["a1-putra"], 0)).rejects.toThrow(/antara 1 dan 6236/);
    await expect(progress("adminKelA1", g["a1-putra"], 6237)).rejects.toThrow(/antara 1 dan 6236/);
    await expect(progress("adminKelA1", g["a1-putra"], 10, "2999-01-01")).rejects.toThrow(/masa depan/);
    await expect(progress("adminKelB1", g["a1-putra"], 10)).rejects.toThrow(/row-level security/);
    await expect(progress("kyaiKelA1", g["a1-putra"], 10)).rejects.toThrow(/row-level security/);
  });
});

describe("rekap capaian lintas unit", () => {
  type Row = { unit_id: string; generus: number; slots: number; tuntas: number; proses: number; kelompok: number; delivered: number; deliverable: number };
  const rekap = (user: keyof typeof u, units: string[], periodId = period) =>
    as(user, async () =>
      (await db.query<Row>(`SELECT * FROM app.capaian_rekap_units($1, $2, $3::uuid[])`, [periodId, j.remaja, units])).rows,
    );
  const strip = (row: Row) => {
    const r: Partial<Row> = { ...row };
    delete r.unit_id;
    return r;
  };

  it("menghitung generus, capaian, dan penyampaian per unit", async () => {
    const rows = await rekap("superadmin", [unit.desaA, unit.desaB, unit.daerah]);
    const by = (id: string) => strip(rows.find((r) => r.unit_id === id)!);
    // desa A: a1-putra, a1-putri, a1-menikah-baru (a1-menikah-lama keluar sebelum periode).
    expect(by(unit.desaA)).toEqual({ generus: 3, slots: 7, tuntas: 3, proses: 1, kelompok: 1, delivered: 1, deliverable: 1 });
    expect(by(unit.desaB)).toEqual({ generus: 1, slots: 2, tuntas: 1, proses: 0, kelompok: 1, delivered: 0, deliverable: 1 });
    expect(by(unit.daerah)).toEqual({ generus: 4, slots: 9, tuntas: 4, proses: 1, kelompok: 2, delivered: 1, deliverable: 2 });
  });

  it("melewati unit di luar lingkup; kurikulum boleh membaca agregat daerah", async () => {
    expect((await rekap("adminKelA1", [unit.desaA, unit.kelA1, unit.kelB1])).map((r) => r.unit_id)).toEqual([unit.kelA1]);
    expect((await rekap("kyaiKelA1", [unit.daerah, unit.kelA1])).map((r) => r.unit_id)).toEqual([unit.kelA1]);
    expect((await rekap("adminDesaA", [unit.desaA, unit.desaB])).map((r) => r.unit_id)).toEqual([unit.desaA]);
    expect((await rekap("kurikulum", [unit.daerah]))[0].slots).toBe(9);
  });

  it("periode draf tidak direkap untuk selain penyusun", async () => {
    expect(await rekap("adminDesaA", [unit.desaA], draft)).toEqual([]);
    expect(await rekap("kurikulum", [unit.daerah], draft)).toHaveLength(1);
  });

  it("rekap per target; ditolak untuk unit di luar lingkup", async () => {
    const rows = await as("kurikulum", async () =>
      (await db.query<{ target_id: string; slots: number; tuntas: number; delivered: number; kelompok: number }>(
        `SELECT * FROM app.capaian_rekap_targets($1, $2, $3)`,
        [period, j.remaja, unit.daerah],
      )).rows,
    );
    const hafalan = rows.find((r) => r.target_id === t.hafalan)!;
    expect(hafalan).toMatchObject({ slots: 4, tuntas: 3 });
    expect(rows.find((r) => r.target_id === t.akhlaq)).toMatchObject({ delivered: 1, kelompok: 2 });
    await expect(
      as("adminKelB1", () => db.query(`SELECT * FROM app.capaian_rekap_targets($1, $2, $3)`, [period, j.remaja, unit.desaA])),
    ).rejects.toThrow(/tidak punya akses/);
    await expect(as("adminKelA1", () => db.query(`SELECT * FROM app.capaian_pairs($1, $2, '')`, [period, j.remaja]))).rejects.toThrow(
      /permission denied/,
    );
  });
});
