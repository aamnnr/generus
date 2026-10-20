import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, createUnit, createUser, grantRole } from "./harness";

let db: PGlite;
const u = {} as Record<"superadmin" | "kurikulum" | "adminDesaA" | "kyaiKelA1", string>;
const unit = {} as Record<"daerah" | "desaA" | "desaB" | "kelA1" | "kelB1", string>;
const g = {} as Record<"a1" | "a1b" | "b1", string>;
const ag: string[] = [];

const OCT = ["2026-10-03", "2026-10-10", "2026-10-17", "2026-10-24"];
const FROM = "2026-10-01T00:00:00+07:00";
const TO = "2026-11-01T00:00:00+07:00";

const as = <T>(who: keyof typeof u, fn: () => Promise<T>) => asUser(db, u[who], fn);

async function addAgenda(day: string) {
  const r = await db.query<{ id: string }>(
    `INSERT INTO agendas (unit_id, title, starts_at, ends_at, late_after, delegate_until)
     VALUES ($1, 'Pengajian daerah', ($2 || 'T19:30:00+07')::timestamptz, ($2 || 'T21:00:00+07')::timestamptz,
             ($2 || 'T19:45:00+07')::timestamptz, ($2 || 'T21:00:00+07')::timestamptz + interval '2 days')
     RETURNING id`,
    [unit.daerah, day],
  );
  return r.rows[0].id;
}

async function mark(agendaId: string, generusId: string, status: string) {
  await db.query(`INSERT INTO attendance (agenda_id, generus_id, status) VALUES ($1, $2, $3)`, [agendaId, generusId, status]);
}

beforeAll(async () => {
  db = await createTestDb();
  unit.daerah = await createUnit(db, "daerah", "Daerah", null);
  unit.desaA = await createUnit(db, "desa", "Desa A", unit.daerah);
  unit.desaB = await createUnit(db, "desa", "Desa B", unit.daerah);
  unit.kelA1 = await createUnit(db, "kelompok", "A1", unit.desaA);
  unit.kelB1 = await createUnit(db, "kelompok", "B1", unit.desaB);
  for (const k of ["superadmin", "kurikulum", "adminDesaA", "kyaiKelA1"] as const) u[k] = await createUser(db, `lap-${k}`);
  await grantRole(db, u.superadmin, unit.daerah, "superadmin");
  await grantRole(db, u.kurikulum, unit.daerah, "kurikulum");
  await grantRole(db, u.adminDesaA, unit.desaA, "admin");
  await grantRole(db, u.kyaiKelA1, unit.kelA1, "kyai");

  const pra = (await db.query<{ id: string }>(`SELECT id FROM jenjang WHERE name = 'Pra Remaja'`)).rows[0].id;
  for (const [key, kel] of [["a1", unit.kelA1], ["a1b", unit.kelA1], ["b1", unit.kelB1]] as const) {
    g[key] = (await db.query<{ id: string }>(
      `INSERT INTO generus (kelompok_id, name, gender, birth_date, jenjang_id) VALUES ($1, $2, 'L', '2012-01-01', $3) RETURNING id`,
      [kel, key, pra],
    )).rows[0].id;
  }

  // September: a1 & a1b hadir, b1 alpa (otomatis saat dikunci).
  const sep = await addAgenda("2026-09-26");
  await mark(sep, g.a1, "hadir");
  await mark(sep, g.a1b, "hadir");
  // Oktober: a1 hadir terus; a1b hadir lalu alpa 3×; b1 izin, alpa, alpa, terlambat.
  for (const day of OCT) ag.push(await addAgenda(day));
  for (const id of ag) await mark(id, g.a1, "hadir");
  await mark(ag[0], g.a1b, "hadir");
  await mark(ag[0], g.b1, "izin");
  await mark(ag[3], g.b1, "terlambat");
  for (const id of [sep, ...ag]) await db.query(`SELECT app.lock_agenda_internal($1)`, [id]);
});

type Rekap = { unit_id: string; generus: number; agendas: number; total: number; hadir: number; terlambat: number; izin: number; sakit: number; alpa: number };
const rekap = (who: keyof typeof u, units: string[]) =>
  as(who, async () => (await db.query<Rekap>(`SELECT * FROM app.kehadiran_rekap_units($1, $2, $3::uuid[])`, [FROM, TO, units])).rows);

describe("rekap kehadiran", () => {
  it("menjumlahkan presensi agenda terkunci per unit dalam bulan", async () => {
    const rows = await rekap("superadmin", [unit.daerah, unit.kelA1, unit.kelB1]);
    const by = (id: string) => rows.find((r) => r.unit_id === id);
    expect(by(unit.daerah)).toMatchObject({ generus: 3, agendas: 4, total: 12, hadir: 5, terlambat: 1, izin: 1, sakit: 0, alpa: 5 });
    expect(by(unit.kelA1)).toMatchObject({ generus: 2, agendas: 4, total: 8, hadir: 5, alpa: 3 });
    expect(by(unit.kelB1)).toMatchObject({ generus: 1, total: 4, izin: 1, terlambat: 1, alpa: 2 });
  });

  it("hanya unit dalam lingkup; Tim Kurikulum tidak mendapat presensi", async () => {
    expect((await rekap("kyaiKelA1", [unit.daerah, unit.kelA1, unit.kelB1])).map((r) => r.unit_id)).toEqual([unit.kelA1]);
    expect((await rekap("adminDesaA", [unit.desaA, unit.desaB])).map((r) => r.unit_id)).toEqual([unit.desaA]);
    expect(await rekap("kurikulum", [unit.daerah])).toEqual([]);
  });

  it("tren bulanan menurut zona waktu aplikasi", async () => {
    const rows = await as("superadmin", async () =>
      (await db.query<{ bulan: string; total: number; hadir: number }>(
        `SELECT bulan::text, total, hadir FROM app.kehadiran_tren($1, '2026-08-01T00:00:00+07', $2, 'Asia/Jakarta')`,
        [unit.daerah, TO],
      )).rows,
    );
    expect(rows).toEqual([
      { bulan: "2026-09-01", total: 3, hadir: 2 },
      { bulan: "2026-10-01", total: 12, hadir: 6 },
    ]);
    await expect(
      as("kurikulum", () => db.query(`SELECT * FROM app.kehadiran_tren($1, $2, $3, 'Asia/Jakarta')`, [unit.daerah, FROM, TO])),
    ).rejects.toThrow(/tidak punya akses/);
  });
});

describe("laporan per generus & peringatan", () => {
  it("merinci presensi per generus dan menandai alpa 3× berturut-turut", async () => {
    const rows = await as("kyaiKelA1", async () =>
      (await db.query<{ name: string; total: number; hadir: number; alpa: number; alpa_streak: boolean; kelompok: string; desa: string }>(
        `SELECT * FROM app.laporan_generus($1, $2, $3, NULL)`,
        [FROM, TO, unit.kelA1],
      )).rows,
    );
    expect(rows.map((r) => [r.name, r.total, r.hadir, r.alpa, r.alpa_streak])).toEqual([
      ["a1", 4, 4, 0, false],
      ["a1b", 4, 1, 3, true],
    ]);
    expect(rows[0]).toMatchObject({ kelompok: "A1", desa: "Desa A" });
  });

  it("peringatan alpa sesuai lingkup; generus yang sudah tidak aktif tidak diperingatkan", async () => {
    const names = async (who: keyof typeof u, unitId: string) =>
      (await as(who, () => db.query<{ name: string }>(`SELECT name FROM app.peringatan_alpa($1)`, [unitId]))).rows.map((r) => r.name);
    expect(await names("superadmin", unit.daerah)).toEqual(["a1b"]);
    expect(await names("kyaiKelA1", unit.kelA1)).toEqual(["a1b"]);
    await expect(names("kyaiKelA1", unit.desaB)).rejects.toThrow(/tidak punya akses/);
    await expect(names("adminDesaA", unit.desaB)).rejects.toThrow(/tidak punya akses/);

    await db.query(`UPDATE generus SET status = 'menikah', status_date = '2026-10-30' WHERE id = $1`, [g.a1b]);
    expect(await names("superadmin", unit.daerah)).toEqual([]);
    // Tetap muncul di laporan bulan itu karena punya presensi.
    const rows = (await as("superadmin", () => db.query<{ name: string }>(`SELECT name FROM app.laporan_generus($1, $2, $3, NULL)`, [FROM, TO, unit.kelA1]))).rows;
    expect(rows.map((r) => r.name)).toEqual(["a1", "a1b"]);
  });
});
