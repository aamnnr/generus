import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, createUnit, createUser, grantRole } from "./harness";

let db: PGlite;
const u = {} as Record<"superadmin" | "adminDesaA" | "adminKelA1" | "kyaiKelA1" | "adminKelB1", string>;
const unit = {} as Record<"daerah" | "desaA" | "desaB" | "kelA1" | "kelA2" | "kelB1", string>;
const j = {} as Record<"pra" | "remaja" | "pelajar" | "mandiri", string>;
const g = {} as Record<string, string>;

async function addGenerus(key: string, kelompokId: string, opts: { jenjang?: "pra" | "pelajar" | "mandiri"; gender?: "L" | "P" } = {}) {
  const jenjang = opts.jenjang ?? "pra";
  const res = await db.query<{ id: string }>(
    `INSERT INTO generus (kelompok_id, name, gender, birth_date, jenjang_id, kategori_id)
     VALUES ($1, $2, $3, '2010-01-01', $4, $5) RETURNING id`,
    [kelompokId, key, opts.gender ?? "L", jenjang === "pra" ? j.pra : j.remaja, jenjang === "pra" ? null : j[jenjang]],
  );
  g[key] = res.rows[0].id;
}

/** Buat agenda sebagai superuser. offsetJam relatif terhadap sekarang. */
async function addAgenda(unitId: string, opts: { startH?: number; endH?: number; delegateH?: number; jenjang?: string[]; kategori?: string[]; gender?: "L" | "P" } = {}) {
  const { startH = -2, endH = -1, delegateH = 48 } = opts;
  const res = await db.query<{ id: string }>(
    `INSERT INTO agendas (unit_id, title, starts_at, ends_at, late_after, delegate_until, target_jenjang_ids, target_kategori_ids, target_gender)
     VALUES ($1, 'Pengajian', now() + make_interval(hours => $2), now() + make_interval(hours => $3),
             now() + make_interval(hours => $2), now() + make_interval(hours => $4), $5::uuid[], $6::uuid[], $7)
     RETURNING id`,
    [unitId, startH, endH, delegateH, opts.jenjang ?? [], opts.kategori ?? [], opts.gender ?? null],
  );
  return res.rows[0].id;
}

async function mark(userId: string, agendaId: string, generusId: string, status = "hadir") {
  return asUser(db, userId, () =>
    db.query(
      `INSERT INTO attendance (agenda_id, generus_id, status) VALUES ($1, $2, $3)
       ON CONFLICT (agenda_id, generus_id) DO UPDATE SET status = EXCLUDED.status`,
      [agendaId, generusId, status],
    ),
  );
}

async function targets(agendaId: string) {
  const r = await db.query<{ name: string }>(
    `SELECT g.name FROM agendas a JOIN generus g ON app.agenda_is_target(a, g) WHERE a.id = $1 ORDER BY g.name`,
    [agendaId],
  );
  return r.rows.map((x) => x.name);
}

beforeAll(async () => {
  db = await createTestDb();
  unit.daerah = await createUnit(db, "daerah", "Daerah", null);
  unit.desaA = await createUnit(db, "desa", "Desa A", unit.daerah);
  unit.desaB = await createUnit(db, "desa", "Desa B", unit.daerah);
  unit.kelA1 = await createUnit(db, "kelompok", "A1", unit.desaA);
  unit.kelA2 = await createUnit(db, "kelompok", "A2", unit.desaA);
  unit.kelB1 = await createUnit(db, "kelompok", "B1", unit.desaB);

  for (const k of Object.keys({ superadmin: 0, adminDesaA: 0, adminKelA1: 0, kyaiKelA1: 0, adminKelB1: 0 }) as (keyof typeof u)[]) {
    u[k] = await createUser(db, `ag-${k}`);
  }
  await grantRole(db, u.superadmin, unit.daerah, "superadmin");
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

  await addGenerus("a1-pra", unit.kelA1);
  await addGenerus("a1-pelajar", unit.kelA1, { jenjang: "pelajar", gender: "P" });
  await addGenerus("a2-mandiri", unit.kelA2, { jenjang: "mandiri" });
  await addGenerus("b1-pra", unit.kelB1);
});

describe("membuat & melihat agenda", () => {
  it("admin desa membuat agenda desa; admin kelompok tidak bisa", async () => {
    const insert = (who: string, unitId: string) =>
      asUser(db, who, () =>
        db.query(
          `INSERT INTO agendas (unit_id, title, starts_at, ends_at, late_after, delegate_until)
           VALUES ($1, 'X', now(), now() + interval '2 hour', now(), now() + interval '2 day')`,
          [unitId],
        ),
      );
    await expect(insert(u.adminDesaA, unit.desaA)).resolves.toBeTruthy();
    await expect(insert(u.adminKelA1, unit.desaA)).rejects.toThrow(/row-level security/);
    await expect(insert(u.adminKelA1, unit.kelA1)).resolves.toBeTruthy();
  });

  it("agenda desa terlihat oleh unit di bawahnya, tidak oleh desa lain", async () => {
    const desaAgenda = await addAgenda(unit.desaA);
    const sees = (who: string) =>
      asUser(db, who, async () => (await db.query(`SELECT 1 FROM agendas WHERE id = $1`, [desaAgenda])).rows.length === 1);
    expect(await sees(u.adminKelA1)).toBe(true);
    expect(await sees(u.kyaiKelA1)).toBe(true);
    expect(await sees(u.superadmin)).toBe(true);
    expect(await sees(u.adminKelB1)).toBe(false);
  });

  it("menolak waktu yang tidak masuk akal", async () => {
    await expect(addAgenda(unit.desaA, { startH: 1, endH: 0 })).rejects.toThrow(/Waktu selesai/);
  });
});

describe("sasaran agenda", () => {
  it("tanpa filter: semua generus aktif di wilayah agenda", async () => {
    expect(await targets(await addAgenda(unit.desaA))).toEqual(["a1-pelajar", "a1-pra", "a2-mandiri"]);
  });
  it("filter Pra Remaja + Remaja Pelajar", async () => {
    const a = await addAgenda(unit.daerah, { jenjang: [j.pra, j.remaja], kategori: [j.pelajar] });
    expect(await targets(a)).toEqual(["a1-pelajar", "a1-pra", "b1-pra"]);
  });
  it("filter jenis kelamin", async () => {
    expect(await targets(await addAgenda(unit.daerah, { gender: "P" }))).toEqual(["a1-pelajar"]);
  });
  it("generus yang menikah setelah agenda tetap dihitung, sebelum agenda tidak", async () => {
    await addGenerus("a1-nikah", unit.kelA1);
    await db.query(`UPDATE generus SET status = 'menikah', status_date = current_date + 1 WHERE id = $1`, [g["a1-nikah"]]);
    const a = await addAgenda(unit.kelA1);
    expect(await targets(a)).toContain("a1-nikah");
    await db.query(`UPDATE generus SET status_date = current_date - 30 WHERE id = $1`, [g["a1-nikah"]]);
    expect(await targets(a)).not.toContain("a1-nikah");
  });
});

describe("hak isi presensi", () => {
  it("pengelola agenda (admin desa) mengisi semua peserta desanya", async () => {
    const a = await addAgenda(unit.desaA);
    await expect(mark(u.adminDesaA, a, g["a1-pra"])).resolves.toBeTruthy();
    await expect(mark(u.adminDesaA, a, g["a2-mandiri"])).resolves.toBeTruthy();
  });

  it("admin kelompok hanya melengkapi anggotanya sendiri pada agenda desa (delegasi)", async () => {
    const a = await addAgenda(unit.desaA);
    await expect(mark(u.adminKelA1, a, g["a1-pra"], "izin")).resolves.toBeTruthy();
    await expect(mark(u.adminKelA1, a, g["a2-mandiri"])).rejects.toThrow(/row-level security/);
  });

  it("kyai dan admin desa lain tidak bisa mengisi", async () => {
    const a = await addAgenda(unit.desaA);
    await expect(mark(u.kyaiKelA1, a, g["a1-pra"])).rejects.toThrow(/row-level security/);
    await expect(mark(u.adminKelB1, a, g["a1-pra"])).rejects.toThrow(/row-level security/);
  });

  it("generus di luar sasaran ditolak", async () => {
    const a = await addAgenda(unit.desaA, { gender: "P" });
    await expect(mark(u.adminDesaA, a, g["a1-pra"])).rejects.toThrow(/row-level security/);
  });

  it("delegasi berhenti setelah batas waktu, pengelola tetap bisa", async () => {
    const a = await addAgenda(unit.desaA, { startH: -50, endH: -49, delegateH: -1 });
    await expect(mark(u.adminKelA1, a, g["a1-pra"])).rejects.toThrow(/row-level security/);
    await expect(mark(u.adminDesaA, a, g["a1-pra"])).resolves.toBeTruthy();
  });

  it("presensi terlihat oleh yang bisa melihat generus-nya", async () => {
    const a = await addAgenda(unit.desaA);
    await mark(u.adminDesaA, a, g["a1-pra"]);
    await mark(u.adminDesaA, a, g["a2-mandiri"]);
    const seen = await asUser(db, u.kyaiKelA1, async () =>
      (await db.query(`SELECT generus_id FROM attendance WHERE agenda_id = $1`, [a])).rows.length,
    );
    expect(seen).toBe(1);
  });
});

describe("penguncian", () => {
  it("agenda lewat batas dikunci otomatis; yang belum tercatat menjadi alpa", async () => {
    const a = await addAgenda(unit.desaA, { startH: -50, endH: -49, delegateH: -1 });
    await mark(u.adminDesaA, a, g["a1-pra"], "hadir");
    const n = (await asUser(db, u.adminKelA1, () => db.query<{ n: number }>(`SELECT app.lock_due_agendas() n`))).rows[0].n;
    expect(n).toBeGreaterThanOrEqual(1);
    const rows = (await db.query<{ name: string; status: string; method: string }>(
      `SELECT g.name, at.status, at.method FROM attendance at JOIN generus g ON g.id = at.generus_id WHERE at.agenda_id = $1 ORDER BY g.name`,
      [a],
    )).rows;
    expect(rows).toEqual([
      { name: "a1-pelajar", status: "alpa", method: "otomatis" },
      { name: "a1-pra", status: "hadir", method: "manual" },
      { name: "a2-mandiri", status: "alpa", method: "otomatis" },
    ]);
    const [{ locked }] = (await db.query<{ locked: boolean }>(`SELECT locked_at IS NOT NULL locked FROM agendas WHERE id = $1`, [a])).rows;
    expect(locked).toBe(true);
  });

  it("setelah dikunci: pengelola masih bisa koreksi (tercatat di audit)", async () => {
    const a = await addAgenda(unit.desaA, { startH: -50, endH: -49, delegateH: -1 });
    await db.query(`SELECT app.lock_due_agendas()`);
    await mark(u.adminDesaA, a, g["a1-pra"], "sakit");
    const [{ n }] = (await db.query<{ n: number }>(
      `SELECT count(*)::int n FROM audit_log WHERE table_name = 'attendance' AND action = 'UPDATE' AND after->>'agenda_id' = $1`,
      [a],
    )).rows;
    expect(n).toBe(1);
  });

  it("kunci manual hanya oleh pengelola dan setelah agenda selesai", async () => {
    const selesai = await addAgenda(unit.desaA, { startH: -3, endH: -2 });
    const belum = await addAgenda(unit.desaA, { startH: 1, endH: 2 });
    await expect(asUser(db, u.adminKelA1, () => db.query(`SELECT app.lock_agenda($1)`, [selesai]))).rejects.toThrow(/pengelola/);
    await expect(asUser(db, u.adminDesaA, () => db.query(`SELECT app.lock_agenda($1)`, [belum]))).rejects.toThrow(/setelah agenda selesai/);
    await asUser(db, u.adminDesaA, () => db.query(`SELECT app.lock_agenda($1)`, [selesai]));
    const [{ n }] = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM attendance WHERE agenda_id = $1`, [selesai])).rows;
    expect(n).toBe(3);
  });
});
