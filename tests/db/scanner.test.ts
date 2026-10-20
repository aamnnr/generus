import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, createUnit, createUser, grantRole } from "./harness";

let db: PGlite;
const u = {} as Record<"adminDesaA" | "adminKelA1" | "petugas" | "kyai", string>;
const unit = {} as Record<"daerah" | "desaA" | "kelA1" | "kelA2", string>;
const g = {} as Record<string, string>;
let agenda: string;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

async function addGenerus(key: string, kelompokId: string) {
  const pra = (await db.query<{ id: string }>(`SELECT id FROM jenjang WHERE name = 'Pra Remaja'`)).rows[0].id;
  g[key] = (
    await db.query<{ id: string }>(
      `INSERT INTO generus (kelompok_id, name, gender, birth_date, jenjang_id) VALUES ($1, $2, 'L', '2011-01-01', $3) RETURNING id`,
      [kelompokId, key, pra],
    )
  ).rows[0].id;
}

const roster = (who: string, id = agenda) =>
  asUser(db, who, async () =>
    (await db.query<{ name: string; token_hash: string | null }>(`SELECT name, token_hash FROM app.agenda_roster($1)`, [id])).rows,
  );

const scan = (who: string, generusId: string, id = agenda) =>
  asUser(db, who, () =>
    db.query(`INSERT INTO attendance (agenda_id, generus_id, status, method) VALUES ($1, $2, 'hadir', 'scan') ON CONFLICT DO NOTHING`, [id, generusId]),
  );

const grant = (who: string, userId: string, expires = "now() + interval '1 day'", id = agenda) =>
  asUser(db, who, () =>
    db.query(
      `INSERT INTO agenda_scanners (agenda_id, user_id, expires_at) VALUES ($1, $2, ${expires})
       ON CONFLICT (agenda_id, user_id) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
      [id, userId],
    ),
  );

beforeAll(async () => {
  db = await createTestDb();
  unit.daerah = await createUnit(db, "daerah", "D", null);
  unit.desaA = await createUnit(db, "desa", "A", unit.daerah);
  unit.kelA1 = await createUnit(db, "kelompok", "A1", unit.desaA);
  unit.kelA2 = await createUnit(db, "kelompok", "A2", unit.desaA);
  for (const k of ["adminDesaA", "adminKelA1", "petugas", "kyai"] as const) u[k] = await createUser(db, `sc-${k}`);
  await grantRole(db, u.adminDesaA, unit.desaA, "admin");
  await grantRole(db, u.adminKelA1, unit.kelA1, "admin");
  await grantRole(db, u.kyai, unit.kelA1, "kyai");
  // `petugas` sengaja tidak punya peran apa pun.
  await addGenerus("a1", unit.kelA1);
  await addGenerus("a2", unit.kelA2);
  await addGenerus("a2-kartu-hilang", unit.kelA2);
  agenda = (
    await db.query<{ id: string }>(
      `INSERT INTO agendas (unit_id, title, starts_at, ends_at, late_after, delegate_until)
       VALUES ($1, 'Pengajian Desa', now() - interval '1 hour', now() + interval '1 hour', now(), now() + interval '2 day') RETURNING id`,
      [unit.desaA],
    )
  ).rows[0].id;
});

describe("roster pemindai", () => {
  it("pengelola mendapat semua peserta dengan hash isi QR, bukan tokennya", async () => {
    const rows = await roster(u.adminDesaA);
    expect(rows.map((r) => r.name)).toEqual(["a1", "a2", "a2-kartu-hilang"]);
    const [{ qr_token }] = (await db.query<{ qr_token: string }>(`SELECT qr_token FROM generus WHERE id = $1`, [g.a1])).rows;
    expect(rows[0].token_hash).toBe(sha(`GNR1:${qr_token}`));
    expect(JSON.stringify(rows)).not.toContain(qr_token);
  });

  it("kartu nonaktif tidak punya hash (tidak bisa dipindai)", async () => {
    // qr_active diatur trigger dari status; paksa nonaktif langsung untuk uji ini.
    await db.query(`ALTER TABLE generus DISABLE TRIGGER generus_before_write`);
    await db.query(`UPDATE generus SET qr_active = false WHERE id = $1`, [g["a2-kartu-hilang"]]);
    await db.query(`ALTER TABLE generus ENABLE TRIGGER generus_before_write`);
    const rows = await roster(u.adminDesaA);
    expect(rows.find((r) => r.name === "a2-kartu-hilang")?.token_hash).toBeNull();
  });

  it("bukan pengelola/petugas ditolak, termasuk admin kelompok dan kyai", async () => {
    await expect(roster(u.adminKelA1)).rejects.toThrow(/bukan pengelola atau petugas/);
    await expect(roster(u.kyai)).rejects.toThrow(/bukan pengelola atau petugas/);
    await expect(roster(u.petugas)).rejects.toThrow(/bukan pengelola atau petugas/);
  });
});

describe("petugas scan", () => {
  it("hanya pengelola agenda yang bisa memberi akses", async () => {
    await expect(grant(u.adminKelA1, u.petugas)).rejects.toThrow(/row-level security/);
    await expect(grant(u.adminDesaA, u.petugas)).resolves.toBeTruthy();
  });

  it("petugas melihat agenda, mengunduh roster, dan memindai semua peserta", async () => {
    await grant(u.adminDesaA, u.petugas);
    const seen = await asUser(db, u.petugas, async () => (await db.query(`SELECT 1 FROM agendas WHERE id = $1`, [agenda])).rows.length);
    expect(seen).toBe(1);
    expect((await roster(u.petugas)).length).toBe(3);
    await expect(scan(u.petugas, g.a1)).resolves.toBeTruthy();
    await expect(scan(u.petugas, g.a2)).resolves.toBeTruthy();
  });

  it("scan kedua tidak menimpa scan pertama", async () => {
    await scan(u.adminDesaA, g.a1);
    const [{ n }] = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM attendance WHERE agenda_id = $1 AND generus_id = $2`, [agenda, g.a1])).rows;
    expect(n).toBe(1);
  });

  it("akses kedaluwarsa ditolak", async () => {
    await grant(u.adminDesaA, u.petugas, "now() - interval '1 minute'");
    await expect(roster(u.petugas)).rejects.toThrow(/bukan pengelola atau petugas/);
    await expect(scan(u.petugas, g["a2-kartu-hilang"])).rejects.toThrow(/row-level security/);
    await grant(u.adminDesaA, u.petugas);
  });

  it("setelah agenda dikunci petugas tidak bisa memindai lagi", async () => {
    await db.query(`UPDATE agendas SET locked_at = now() WHERE id = $1`, [agenda]);
    await expect(scan(u.petugas, g["a2-kartu-hilang"])).rejects.toThrow(/row-level security/);
    await db.query(`UPDATE agendas SET locked_at = NULL WHERE id = $1`, [agenda]);
  });

  it("petugas hanya melihat aksesnya sendiri; pemberian akses tercatat di audit", async () => {
    const own = await asUser(db, u.petugas, async () => (await db.query(`SELECT user_id FROM agenda_scanners`)).rows.length);
    expect(own).toBe(1);
    const [{ n }] = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM audit_log WHERE table_name = 'agenda_scanners'`)).rows;
    expect(n).toBeGreaterThan(0);
  });
});
