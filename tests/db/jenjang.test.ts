import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, createUnit, createUser, grantRole, migrationFiles } from "./harness";

// Jenjang Balita (hanya didata) & Caberawit (PAUD/TK, SD) — migrasi 0021/0022.

let db: PGlite;
const unit = {} as Record<"daerah" | "desa" | "kel", string>;
const j = {} as Record<"balita" | "caberawit" | "pra" | "remaja" | "paud" | "sd" | "pelajar", string>;
let admin: string;

async function addGenerus(name: string, jenjangId: string, kategoriId: string | null) {
  const r = await db.query<{ id: string }>(
    `INSERT INTO generus (kelompok_id, name, gender, birth_date, jenjang_id, kategori_id) VALUES ($1, $2, 'L', '2020-01-01', $3, $4) RETURNING id`,
    [unit.kel, name, jenjangId, kategoriId],
  );
  return r.rows[0].id;
}

async function addAgenda(jenjangIds: string[] = [], kategoriIds: string[] = []) {
  const r = await db.query<{ id: string }>(
    `INSERT INTO agendas (unit_id, title, starts_at, ends_at, late_after, delegate_until, target_jenjang_ids, target_kategori_ids)
     VALUES ($1, 'Pengajian', now(), now() + interval '2 hour', now(), now() + interval '2 day', $2::uuid[], $3::uuid[]) RETURNING id`,
    [unit.desa, jenjangIds, kategoriIds],
  );
  return r.rows[0].id;
}

const targets = async (agendaId: string) =>
  (await db.query<{ name: string }>(`SELECT g.name FROM agendas a JOIN generus g ON app.agenda_is_target(a, g) WHERE a.id = $1 ORDER BY g.name`, [agendaId])).rows.map(
    (r) => r.name,
  );

beforeAll(async () => {
  db = await createTestDb();
  unit.daerah = await createUnit(db, "daerah", "D", null);
  unit.desa = await createUnit(db, "desa", "Desa", unit.daerah);
  unit.kel = await createUnit(db, "kelompok", "Kel", unit.desa);
  admin = await createUser(db, "adm-jenjang");
  await grantRole(db, admin, unit.desa, "admin");
  const rows = (await db.query<{ jn: string; jid: string; kn: string | null; kid: string | null }>(
    `SELECT j.name jn, j.id jid, k.name kn, k.id kid FROM jenjang j LEFT JOIN jenjang_kategori k ON k.jenjang_id = j.id`,
  )).rows;
  const jid = (n: string) => rows.find((r) => r.jn === n)!.jid;
  const kid = (n: string) => rows.find((r) => r.kn === n)!.kid!;
  Object.assign(j, {
    balita: jid("Balita"),
    caberawit: jid("Caberawit"),
    pra: jid("Pra Remaja"),
    remaja: jid("Remaja"),
    paud: kid("PAUD/TK"),
    sd: kid("SD"),
    pelajar: kid("Pelajar"),
  });
  await addGenerus("balita", j.balita, null);
  await addGenerus("paud", j.caberawit, j.paud);
  await addGenerus("sd", j.caberawit, j.sd);
  await addGenerus("pra", j.pra, null);
  await addGenerus("pelajar", j.remaja, j.pelajar);
});

describe("jenjang Balita & Caberawit", () => {
  it("urutan jenjang: Balita, Caberawit, Pra Remaja, Remaja; hanya Balita yang tidak ikut kegiatan", async () => {
    const r = await db.query<{ name: string; ikut_kegiatan: boolean }>(`SELECT name, ikut_kegiatan FROM jenjang ORDER BY sort_order`);
    expect(r.rows).toEqual([
      { name: "Balita", ikut_kegiatan: false },
      { name: "Caberawit", ikut_kegiatan: true },
      { name: "Pra Remaja", ikut_kegiatan: true },
      { name: "Remaja", ikut_kegiatan: true },
    ]);
  });

  it("agenda 'semua jenjang' memuat Caberawit, tidak pernah Balita", async () => {
    expect(await targets(await addAgenda())).toEqual(["paud", "pelajar", "pra", "sd"]);
  });

  it("Balita tetap bukan sasaran walau jenjangnya dipilih langsung", async () => {
    expect(await targets(await addAgenda([j.balita, j.caberawit]))).toEqual(["paud", "sd"]);
  });

  it("agenda khusus Caberawit SD", async () => {
    expect(await targets(await addAgenda([j.caberawit], [j.sd]))).toEqual(["sd"]);
  });

  it("presensi untuk Balita ditolak", async () => {
    const a = await addAgenda();
    const balita = (await db.query<{ id: string }>(`SELECT id FROM generus WHERE name = 'balita'`)).rows[0].id;
    await expect(
      asUser(db, admin, () => db.query(`INSERT INTO attendance (agenda_id, generus_id, status) VALUES ($1, $2, 'hadir')`, [a, balita])),
    ).rejects.toThrow(/row-level security/);
  });

  it("admin bisa mendata Balita sebagai generus", async () => {
    await expect(
      asUser(db, admin, () =>
        db.query(`INSERT INTO generus (kelompok_id, name, gender, birth_date, jenjang_id) VALUES ($1, 'bayi', 'P', '2025-05-01', $2)`, [unit.kel, j.balita]),
      ),
    ).resolves.toBeTruthy();
  });
});

describe("migrasi 0022 pada agenda yang sudah ada", () => {
  it("agenda terbuka 'semua jenjang' ditetapkan ke Pra Remaja & Remaja; yang terkunci/dibatalkan tidak diubah", async () => {
    const old = await createTestDb({ before: "0022_caberawit_balita" });
    const d = (await old.query<{ id: string }>(`INSERT INTO units (level, name) VALUES ('daerah', 'X') RETURNING id`)).rows[0].id;
    const mk = async (col: "locked_at" | "cancelled_at" | null) =>
      (await old.query<{ id: string }>(
        `INSERT INTO agendas (unit_id, title, starts_at, ends_at, late_after, delegate_until, locked_at, cancelled_at)
         VALUES ($1, 'A', now() - interval '3 hour', now() - interval '2 hour', now() - interval '3 hour', now() + interval '1 day', $2, $3)
         RETURNING id`,
        [d, col === "locked_at" ? new Date() : null, col === "cancelled_at" ? new Date() : null],
      )).rows[0].id;
    const open = await mk(null);
    const locked = await mk("locked_at");
    const cancelled = await mk("cancelled_at");
    const file = migrationFiles().find((f) => f.includes("0022_caberawit_balita"))!;
    await old.exec(readFileSync(file, "utf8"));
    const names = async (id: string) =>
      (await old.query<{ name: string }>(`SELECT j.name FROM agendas a JOIN jenjang j ON j.id = ANY (a.target_jenjang_ids) WHERE a.id = $1 ORDER BY j.sort_order`, [id])).rows.map((r) => r.name);
    expect(await names(open)).toEqual(["Pra Remaja", "Remaja"]);
    expect(await names(locked)).toEqual([]);
    expect(await names(cancelled)).toEqual([]);
    await old.close();
  });
});
