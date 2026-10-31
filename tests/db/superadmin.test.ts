import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, createUnit, createUser, grantRole } from "./harness";

// Superadmin sistem vs superadmin daerah (drizzle/0016_superadmin_scope.sql).

let db: PGlite;
const u = {} as Record<"sistem" | "superA" | "adminA" | "adminB" | "baru", string>;
const unit = {} as Record<"daerahA" | "daerahB" | "desaA" | "desaB" | "kelA", string>;

beforeAll(async () => {
  db = await createTestDb();
  unit.daerahA = await createUnit(db, "daerah", "Daerah A", null);
  unit.daerahB = await createUnit(db, "daerah", "Daerah B", null);
  unit.desaA = await createUnit(db, "desa", "Desa A", unit.daerahA);
  unit.desaB = await createUnit(db, "desa", "Desa B", unit.daerahB);
  unit.kelA = await createUnit(db, "kelompok", "Kel A", unit.desaA);
  for (const k of ["sistem", "superA", "adminA", "adminB", "baru"] as const) u[k] = await createUser(db, k);
  await grantRole(db, u.sistem, unit.daerahA, "superadmin");
  await db.query(`INSERT INTO system_admins (user_id) VALUES ($1)`, [u.sistem]);
  await grantRole(db, u.superA, unit.daerahA, "superadmin");
  await grantRole(db, u.adminA, unit.desaA, "admin");
  await grantRole(db, u.adminB, unit.desaB, "admin");
});

const insertUnit = (who: string, level: string, name: string, parent: string | null) =>
  asUser(db, who, () => db.query(`INSERT INTO units (level, name, parent_id) VALUES ($1, $2, $3) RETURNING id`, [level, name, parent]));

describe("wilayah", () => {
  it("superadmin sistem bisa menambah daerah baru", async () => {
    const r = await insertUnit(u.sistem, "daerah", "Daerah C", null);
    expect(r.rows).toHaveLength(1);
  });

  it("superadmin daerah tidak bisa menambah daerah", async () => {
    await expect(insertUnit(u.superA, "daerah", "Daerah D", null)).rejects.toThrow(/row-level security/);
  });

  it("superadmin daerah menambah desa/kelompok hanya di daerahnya", async () => {
    expect((await insertUnit(u.superA, "desa", "Desa A2", unit.daerahA)).rows).toHaveLength(1);
    expect((await insertUnit(u.superA, "kelompok", "Kel A2", unit.desaA)).rows).toHaveLength(1);
    await expect(insertUnit(u.superA, "desa", "Desa B2", unit.daerahB)).rejects.toThrow(/row-level security/);
  });

  it("superadmin daerah tidak bisa mengubah nama daerah atau unit daerah lain", async () => {
    const own = await asUser(db, u.superA, () => db.query(`UPDATE units SET name = 'X' WHERE id = $1`, [unit.daerahA]));
    const other = await asUser(db, u.superA, () => db.query(`UPDATE units SET name = 'X' WHERE id = $1`, [unit.desaB]));
    expect(own.affectedRows).toBe(0);
    expect(other.affectedRows).toBe(0);
    const mine = await asUser(db, u.superA, () => db.query(`UPDATE units SET name = 'Desa A' WHERE id = $1`, [unit.desaA]));
    expect(mine.affectedRows).toBe(1);
  });
});

describe("akun & peran", () => {
  it("superadmin daerah hanya melihat akun di daerahnya", async () => {
    const r = await asUser(db, u.superA, () => db.query<{ id: string }>(`SELECT id FROM profiles`));
    const ids = r.rows.map((x) => x.id);
    expect(ids).toContain(u.adminA);
    expect(ids).not.toContain(u.adminB);
    const all = await asUser(db, u.sistem, () => db.query(`SELECT id FROM profiles`));
    expect(all.rows.length).toBeGreaterThanOrEqual(5);
  });

  it("memberi peran hanya untuk unit di daerahnya", async () => {
    await asUser(db, u.superA, () => db.query(`INSERT INTO user_roles (user_id, unit_id, role) VALUES ($1, $2, 'admin')`, [u.baru, unit.kelA]));
    await expect(
      asUser(db, u.superA, () => db.query(`INSERT INTO user_roles (user_id, unit_id, role) VALUES ($1, $2, 'admin')`, [u.baru, unit.desaB])),
    ).rejects.toThrow(/row-level security/);
  });

  it("akun baru bisa dilengkapi setelah perannya masuk lingkup", async () => {
    const r = await asUser(db, u.superA, () =>
      db.query(`UPDATE profiles SET must_change_password = true, phone = '08' WHERE id = $1`, [u.baru]),
    );
    expect(r.affectedRows).toBe(1);
  });

  it("tidak bisa mengelola akun daerah lain atau superadmin sistem", async () => {
    const other = await asUser(db, u.superA, () => db.query(`UPDATE profiles SET active = false WHERE id = $1`, [u.adminB]));
    expect(other.affectedRows).toBe(0);
    const sys = await asUser(db, u.superA, () => db.query(`UPDATE profiles SET active = false WHERE id = $1`, [u.sistem]));
    expect(sys.affectedRows).toBe(0);
    await asUser(db, u.superA, () => db.query(`DELETE FROM user_roles WHERE user_id = $1`, [u.sistem]));
    const left = await db.query(`SELECT 1 FROM user_roles WHERE user_id = $1`, [u.sistem]);
    expect(left.rows).toHaveLength(1);
    const managed = await asUser(db, u.superA, () => db.query(`UPDATE profiles SET active = false WHERE id = $1`, [u.adminA]));
    expect(managed.affectedRows).toBe(1);
    await db.query(`UPDATE profiles SET active = true WHERE id = $1`, [u.adminA]);
  });

  it("status superadmin sistem tidak bisa diberikan dari aplikasi", async () => {
    await expect(
      asUser(db, u.superA, () => db.query(`INSERT INTO system_admins (user_id) VALUES ($1)`, [u.superA])),
    ).rejects.toThrow(/permission denied|row-level security/);
    const self = await asUser(db, u.sistem, () => db.query(`SELECT app.is_system_admin() AS v`));
    expect((self.rows[0] as { v: boolean }).v).toBe(true);
  });
});

describe("data & audit", () => {
  it("superadmin sistem melihat generus semua daerah tanpa peran di sana", async () => {
    const kelB = (await db.query<{ id: string }>(`INSERT INTO units (level, name, parent_id) VALUES ('kelompok', 'Kel B', $1) RETURNING id`, [unit.desaB])).rows[0].id;
    const j = (await db.query<{ id: string }>(`SELECT id FROM jenjang WHERE name = 'Pra Remaja'`)).rows[0].id;
    await db.query(`INSERT INTO generus (kelompok_id, name, gender, birth_date, jenjang_id) VALUES ($1, 'Generus B', 'L', '2012-01-01', $2)`, [kelB, j]);
    const sys = await asUser(db, u.sistem, () => db.query(`SELECT name FROM generus`));
    const sa = await asUser(db, u.superA, () => db.query(`SELECT name FROM generus`));
    expect(sys.rows).toHaveLength(1);
    expect(sa.rows).toHaveLength(0);
  });

  it("audit log & jenjang hanya untuk superadmin sistem", async () => {
    const sa = await asUser(db, u.superA, () => db.query(`SELECT * FROM audit_log`));
    const sys = await asUser(db, u.sistem, () => db.query(`SELECT * FROM audit_log`));
    expect(sa.rows).toHaveLength(0);
    expect(sys.rows.length).toBeGreaterThan(0);
    const upd = await asUser(db, u.superA, () => db.query(`UPDATE jenjang SET sort_order = sort_order`));
    expect(upd.affectedRows).toBe(0);
  });
});
