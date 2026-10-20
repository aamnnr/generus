import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, createUnit, createUser, grantRole } from "./harness";

let db: PGlite;
const u = {} as Record<
  "superadmin" | "kurikulum" | "adminDesaA" | "adminKelA1" | "kyaiKelA1" | "adminKelB1",
  string
>;
const unit = {} as Record<"daerah" | "desaA" | "desaB" | "kelA1" | "kelA2" | "kelB1", string>;
let praRemaja: string;
let remaja: string;
let pelajar: string;

async function addGenerus(kelompokId: string, name: string) {
  const res = await db.query<{ id: string }>(
    `INSERT INTO generus (kelompok_id, name, gender, birth_date, jenjang_id)
     VALUES ($1, $2, 'L', '2012-05-01', $3) RETURNING id`,
    [kelompokId, name, praRemaja],
  );
  return res.rows[0].id;
}

async function visibleNames(userId: string) {
  return asUser(db, userId, async () =>
    (await db.query<{ name: string }>(`SELECT name FROM generus ORDER BY name`)).rows.map((r) => r.name),
  );
}

beforeAll(async () => {
  db = await createTestDb();

  unit.daerah = await createUnit(db, "daerah", "Daerah Uji", null);
  unit.desaA = await createUnit(db, "desa", "Desa A", unit.daerah);
  unit.desaB = await createUnit(db, "desa", "Desa B", unit.daerah);
  unit.kelA1 = await createUnit(db, "kelompok", "A1", unit.desaA);
  unit.kelA2 = await createUnit(db, "kelompok", "A2", unit.desaA);
  unit.kelB1 = await createUnit(db, "kelompok", "B1", unit.desaB);

  for (const key of Object.keys({
    superadmin: 0, kurikulum: 0, adminDesaA: 0, adminKelA1: 0, kyaiKelA1: 0, adminKelB1: 0,
  }) as (keyof typeof u)[]) {
    u[key] = await createUser(db, key);
  }
  await grantRole(db, u.superadmin, unit.daerah, "superadmin");
  await grantRole(db, u.kurikulum, unit.daerah, "kurikulum");
  await grantRole(db, u.adminDesaA, unit.desaA, "admin");
  await grantRole(db, u.adminKelA1, unit.kelA1, "admin");
  await grantRole(db, u.kyaiKelA1, unit.kelA1, "kyai");
  await grantRole(db, u.adminKelB1, unit.kelB1, "admin");

  const j = await db.query<{ name: string; id: string }>(`SELECT name, id FROM jenjang`);
  praRemaja = j.rows.find((r) => r.name === "Pra Remaja")!.id;
  remaja = j.rows.find((r) => r.name === "Remaja")!.id;
  pelajar = (await db.query<{ id: string }>(`SELECT id FROM jenjang_kategori WHERE name = 'Pelajar'`)).rows[0].id;

  await addGenerus(unit.kelA1, "Generus A1");
  await addGenerus(unit.kelA2, "Generus A2");
  await addGenerus(unit.kelB1, "Generus B1");
});

describe("struktur wilayah", () => {
  it("membentuk path hierarki daerah > desa > kelompok", async () => {
    const r = await db.query<{ ok: boolean }>(
      `SELECT k.path <@ d.path AS ok FROM units k, units d WHERE k.id = $1 AND d.id = $2`,
      [unit.kelA1, unit.daerah],
    );
    expect(r.rows[0].ok).toBe(true);
  });

  it("menolak kelompok langsung di bawah daerah", async () => {
    await expect(createUnit(db, "kelompok", "Salah", unit.daerah)).rejects.toThrow(/tidak boleh berada di bawah/);
  });

  it("membuat profil otomatis dari akun auth", async () => {
    const r = await db.query<{ name: string }>(`SELECT name FROM profiles WHERE id = $1`, [u.kyaiKelA1]);
    expect(r.rows[0].name).toBe("kyaiKelA1");
  });

  it("unit yang masih berisi kelompok/generus tidak bisa dihapus, unit kosong bisa", async () => {
    await expect(
      asUser(db, u.superadmin, () => db.query(`DELETE FROM units WHERE id = $1`, [unit.desaB])),
    ).rejects.toThrow(/foreign key/);
    const kosong = await createUnit(db, "kelompok", "Kosong", unit.desaB);
    const r = await asUser(db, u.superadmin, () => db.query(`DELETE FROM units WHERE id = $1`, [kosong]));
    expect(r.affectedRows).toBe(1);
  });

  it("hanya superadmin yang bisa mengubah wilayah", async () => {
    const r = await asUser(db, u.adminDesaA, () => db.query(`UPDATE units SET name = 'X' WHERE id = $1`, [unit.kelA1]));
    expect(r.affectedRows).toBe(0);
  });

  it("peran kurikulum hanya di tingkat daerah", async () => {
    await expect(grantRole(db, u.adminDesaA, unit.desaA, "kurikulum")).rejects.toThrow(/hanya untuk unit tingkat daerah/);
  });
});

describe("lingkup baca generus", () => {
  it("superadmin melihat semua", async () => {
    expect(await visibleNames(u.superadmin)).toEqual(["Generus A1", "Generus A2", "Generus B1"]);
  });
  it("admin desa melihat semua kelompok di desanya saja", async () => {
    expect(await visibleNames(u.adminDesaA)).toEqual(["Generus A1", "Generus A2"]);
  });
  it("admin kelompok hanya melihat kelompoknya", async () => {
    expect(await visibleNames(u.adminKelA1)).toEqual(["Generus A1"]);
  });
  it("kyai kelompok melihat kelompoknya", async () => {
    expect(await visibleNames(u.kyaiKelA1)).toEqual(["Generus A1"]);
  });
  it("tim kurikulum tidak melihat data generus", async () => {
    expect(await visibleNames(u.kurikulum)).toEqual([]);
  });
});

describe("hak tulis generus", () => {
  it("admin kelompok bisa menambah di kelompoknya", async () => {
    await asUser(db, u.adminKelA1, () => addGenerus(unit.kelA1, "Baru A1"));
    expect(await visibleNames(u.adminKelA1)).toContain("Baru A1");
  });

  it("admin kelompok tidak bisa menambah di kelompok lain", async () => {
    await expect(asUser(db, u.adminKelA1, () => addGenerus(unit.kelB1, "Nyasar"))).rejects.toThrow(
      /row-level security/,
    );
  });

  it("kyai tidak bisa mengubah data", async () => {
    const r = await asUser(db, u.kyaiKelA1, () =>
      db.query(`UPDATE generus SET name = 'Diubah' WHERE name = 'Generus A1'`),
    );
    expect(r.affectedRows).toBe(0);
  });

  it("admin kelompok tidak boleh memutasi generus", async () => {
    await expect(
      asUser(db, u.adminKelA1, () =>
        db.query(`UPDATE generus SET kelompok_id = $1 WHERE name = 'Generus A1'`, [unit.kelA2]),
      ),
    ).rejects.toThrow(/Mutasi kelompok/);
  });

  it("admin desa memutasi antar kelompok di desanya dan tercatat", async () => {
    await asUser(db, u.adminDesaA, () =>
      db.query(`UPDATE generus SET kelompok_id = $1 WHERE name = 'Generus A1'`, [unit.kelA2]),
    );
    const m = await db.query(
      `SELECT 1 FROM generus_mutations gm JOIN generus g ON g.id = gm.generus_id WHERE g.name = 'Generus A1'`,
    );
    expect(m.rows).toHaveLength(1);
    expect(await visibleNames(u.adminKelA1)).not.toContain("Generus A1");
  });
});

describe("aturan jenjang & status", () => {
  it("Remaja wajib punya kategori", async () => {
    await expect(
      db.query(
        `INSERT INTO generus (kelompok_id, name, gender, birth_date, jenjang_id) VALUES ($1, 'R', 'P', '2008-01-01', $2)`,
        [unit.kelA1, remaja],
      ),
    ).rejects.toThrow(/Kategori wajib/);
  });

  it("Pra Remaja tidak memakai kategori", async () => {
    await expect(
      db.query(
        `INSERT INTO generus (kelompok_id, name, gender, birth_date, jenjang_id, kategori_id)
         VALUES ($1, 'PR', 'P', '2012-01-01', $2, $3)`,
        [unit.kelA1, praRemaja, pelajar],
      ),
    ).rejects.toThrow(/tidak memakai kategori/);
  });

  it("status menikah menonaktifkan QR dan tercatat di riwayat", async () => {
    await asUser(db, u.adminKelB1, () => db.query(`UPDATE generus SET status = 'menikah' WHERE name = 'Generus B1'`));
    const g = await db.query<{ qr_active: boolean; status_date: string | null }>(
      `SELECT qr_active, status_date FROM generus WHERE name = 'Generus B1'`,
    );
    expect(g.rows[0].qr_active).toBe(false);
    expect(g.rows[0].status_date).not.toBeNull();
    const h = await db.query(`SELECT to_status FROM generus_status_history`);
    expect(h.rows).toEqual([{ to_status: "menikah" }]);
  });

  it("setiap generus punya qr_token unik 16 karakter", async () => {
    const r = await db.query<{ n: number; d: number; len: number }>(
      `SELECT count(*)::int n, count(DISTINCT qr_token)::int d, min(length(qr_token))::int len FROM generus`,
    );
    expect(r.rows[0].n).toBe(r.rows[0].d);
    expect(r.rows[0].len).toBe(16);
  });
});

describe("audit & akun", () => {
  it("audit log hanya terbaca superadmin", async () => {
    const asAdmin = await asUser(db, u.adminDesaA, () => db.query(`SELECT * FROM audit_log`));
    const asSuper = await asUser(db, u.superadmin, () => db.query(`SELECT * FROM audit_log`));
    expect(asAdmin.rows).toHaveLength(0);
    expect(asSuper.rows.length).toBeGreaterThan(0);
  });

  it("user tidak bisa mengaktifkan/menonaktifkan akunnya sendiri", async () => {
    await expect(
      asUser(db, u.adminKelA1, () => db.query(`UPDATE profiles SET active = false WHERE id = $1`, [u.adminKelA1])),
    ).rejects.toThrow(/Hanya superadmin/);
  });

  it("email profil tersalin dari akun auth dan tidak bisa diubah sendiri", async () => {
    const r = await db.query<{ email: string }>(`SELECT email FROM profiles WHERE id = $1`, [u.adminKelA1]);
    expect(r.rows[0].email).toBe("adminkela1@generus.test");
    await expect(
      asUser(db, u.adminKelA1, () => db.query(`UPDATE profiles SET email = 'x@y.z' WHERE id = $1`, [u.adminKelA1])),
    ).rejects.toThrow(/Email hanya bisa diubah superadmin/);
    await db.query(`UPDATE auth.users SET email = 'baru@generus.test' WHERE id = $1`, [u.adminKelA1]);
    const r2 = await db.query<{ email: string }>(`SELECT email FROM profiles WHERE id = $1`, [u.adminKelA1]);
    expect(r2.rows[0].email).toBe("baru@generus.test");
  });

  it("user boleh menghapus tanda wajib-ganti-password miliknya", async () => {
    await db.query(`UPDATE profiles SET must_change_password = true WHERE id = $1`, [u.adminKelB1]);
    const r = await asUser(db, u.adminKelB1, () =>
      db.query(`UPDATE profiles SET must_change_password = false WHERE id = $1`, [u.adminKelB1]),
    );
    expect(r.affectedRows).toBe(1);
  });

  it("akun nonaktif kehilangan akses", async () => {
    await asUser(db, u.superadmin, () => db.query(`UPDATE profiles SET active = false WHERE id = $1`, [u.kyaiKelA1]));
    expect(await visibleNames(u.kyaiKelA1)).toEqual([]);
  });
});
