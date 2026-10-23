import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, createUnit, createUser, grantRole } from "./harness";

// Fungsi RPC public.mobile_* untuk aplikasi Android (drizzle/0014_mobile_api.sql).
// Semuanya SECURITY INVOKER: hasilnya harus mengikuti RLS yang sama dengan PWA.

let db: PGlite;
const u = {} as Record<"superadmin" | "kurikulum" | "adminDesaA" | "adminKelA1" | "kyaiKelA1" | "adminKelB1" | "petugas", string>;
const unit = {} as Record<"daerah" | "desaA" | "desaB" | "kelA1" | "kelA2" | "kelB1", string>;
const j = {} as Record<"pra" | "remaja" | "pelajar" | "mandiri", string>;
const g = {} as Record<string, string>;
let agenda = "";
let period = "";
let target = "";
let kitabTarget = "";
let kitab = "";

const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
const as = <T>(user: keyof typeof u, fn: () => Promise<T>) => asUser(db, u[user], fn);
const rpc = <T>(user: keyof typeof u, sql: string, params: unknown[] = []) => as(user, () => one<{ r: T }>(`SELECT ${sql} AS r`, params)).then((x) => x.r);
const rows = <T>(user: keyof typeof u, sql: string, params: unknown[] = []) => as(user, async () => (await db.query<T>(sql, params)).rows);

async function addGenerus(key: string, kelompokId: string, jenjang: "pra" | "pelajar" | "mandiri" = "pra") {
  g[key] = (
    await one<{ id: string }>(
      `INSERT INTO generus (kelompok_id, name, gender, birth_date, jenjang_id, kategori_id)
       VALUES ($1, $2, 'L', '2010-01-01', $3, $4) RETURNING id`,
      [kelompokId, key, jenjang === "pra" ? j.pra : j.remaja, jenjang === "pra" ? null : j[jenjang]],
    )
  ).id;
}

beforeAll(async () => {
  db = await createTestDb();
  unit.daerah = await createUnit(db, "daerah", "Daerah", null);
  unit.desaA = await createUnit(db, "desa", "Desa A", unit.daerah);
  unit.desaB = await createUnit(db, "desa", "Desa B", unit.daerah);
  unit.kelA1 = await createUnit(db, "kelompok", "A1", unit.desaA);
  unit.kelA2 = await createUnit(db, "kelompok", "A2", unit.desaA);
  unit.kelB1 = await createUnit(db, "kelompok", "B1", unit.desaB);
  for (const k of Object.keys({ superadmin: 1, kurikulum: 1, adminDesaA: 1, adminKelA1: 1, kyaiKelA1: 1, adminKelB1: 1, petugas: 1 }) as (keyof typeof u)[]) {
    u[k] = await createUser(db, `mob-${k}`);
  }
  await grantRole(db, u.superadmin, unit.daerah, "superadmin");
  await grantRole(db, u.kurikulum, unit.daerah, "kurikulum");
  await grantRole(db, u.adminDesaA, unit.desaA, "admin");
  await grantRole(db, u.adminKelA1, unit.kelA1, "admin");
  await grantRole(db, u.kyaiKelA1, unit.kelA1, "kyai");
  await grantRole(db, u.adminKelB1, unit.kelB1, "admin");

  for (const r of (
    await db.query<{ jn: string; jid: string; kn: string | null; kid: string | null }>(
      `SELECT j.name jn, j.id jid, k.name kn, k.id kid FROM jenjang j LEFT JOIN jenjang_kategori k ON k.jenjang_id = j.id`,
    )
  ).rows) {
    if (r.jn === "Pra Remaja") j.pra = r.jid;
    if (r.jn === "Remaja") j.remaja = r.jid;
    if (r.kn === "Pelajar") j.pelajar = r.kid!;
    if (r.kn === "Mandiri") j.mandiri = r.kid!;
  }

  await addGenerus("Ahmad", unit.kelA1);
  await addGenerus("Budi", unit.kelA1, "pelajar");
  await addGenerus("Citra", unit.kelA2);
  await addGenerus("Dodi", unit.kelB1);

  agenda = (
    await one<{ id: string }>(
      `INSERT INTO agendas (unit_id, title, starts_at, ends_at, late_after, delegate_until)
       VALUES ($1, 'Pengajian Desa A', now() - interval '1 hour', now() + interval '1 hour', now() - interval '30 min', now() + interval '2 day')
       RETURNING id`,
      [unit.desaA],
    )
  ).id;

  period = (
    await one<{ id: string }>(
      `INSERT INTO curriculum_periods (name, semester, starts_on, ends_on, published_at)
       VALUES ('Oktober', '1-2026', current_date - 10, current_date + 20, now()) RETURNING id`,
    )
  ).id;
  const materi = (await one<{ id: string }>(`INSERT INTO materi (aspek, mapel, title) VALUES ('alim', 'Hafalan', 'Doa makan') RETURNING id`)).id;
  target = (
    await one<{ id: string }>(
      `INSERT INTO period_targets (period_id, jenjang_id, aspek, mapel, materi_id, sort_order) VALUES ($1, $2, 'alim', 'Hafalan', $3, 0) RETURNING id`,
      [period, j.pra, materi],
    )
  ).id;
  kitab = (await one<{ id: string }>(`INSERT INTO kitab (title, unit, total) VALUES ('Bacaan', 'ayat', 6236) RETURNING id`)).id;
  kitabTarget = (
    await one<{ id: string }>(
      `INSERT INTO period_targets (period_id, jenjang_id, aspek, mapel, kitab_id, range_from, range_to, sort_order)
       VALUES ($1, $2, 'alim', 'Bacaan', $3, 10, 20, 1) RETURNING id`,
      [period, j.pra, kitab],
    )
  ).id;
});

describe("hak akses fungsi mobile", () => {
  it("hanya role authenticated yang boleh memanggil", async () => {
    const r = await one<{ anon: boolean; auth: boolean }>(
      `SELECT has_function_privilege('anon', 'public.mobile_me()', 'EXECUTE') AS anon,
              has_function_privilege('authenticated', 'public.mobile_me()', 'EXECUTE') AS auth`,
    );
    expect(r).toEqual({ anon: false, auth: true });
    const insecure = await db.query(
      `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname LIKE 'mobile\\_%' AND (p.prosecdef OR has_function_privilege('anon', p.oid, 'EXECUTE'))`,
    );
    expect(insecure.rows).toEqual([]);
  });
});

describe("mobile_me & beranda", () => {
  it("mengembalikan profil dan peran user yang login", async () => {
    const me = await rpc<{ id: string; roles: { role: string; unit_name: string }[] }>("adminKelA1", "public.mobile_me()");
    expect(me.id).toBe(u.adminKelA1);
    expect(me.roles).toEqual([expect.objectContaining({ role: "admin", unit_name: "A1" })]);
  });

  it("beranda menghitung sasaran sesuai lingkup user", async () => {
    const desa = await rpc<{ hero: { targets: number; can_manage: boolean }; counts: { total: number } }>("adminDesaA", "public.mobile_beranda()");
    expect(desa.hero.targets).toBe(3);
    expect(desa.hero.can_manage).toBe(true);
    expect(desa.counts.total).toBe(3);
    const kel = await rpc<{ hero: { targets: number; can_manage: boolean } }>("adminKelA1", "public.mobile_beranda()");
    expect(kel.hero.targets).toBe(2);
    expect(kel.hero.can_manage).toBe(false);
  });
});

describe("agenda & presensi", () => {
  it("daftar agenda mendatang terlihat sesuai RLS", async () => {
    const list = await rpc<{ rows: { title: string }[]; has_more: boolean }>("adminKelA1", "public.mobile_agendas('mendatang')");
    expect(list.rows.map((r) => r.title)).toEqual(["Pengajian Desa A"]);
    expect(list.has_more).toBe(false);
    const b = await rpc<{ rows: unknown[] }>("adminKelB1", "public.mobile_agendas('mendatang')");
    expect(b.rows).toEqual([]);
  });

  it("detail agenda: admin kelompok hanya melihat anggotanya", async () => {
    const a = await rpc<{ roster: { name: string; can_write: boolean }[] }>("adminKelA1", "public.mobile_agenda($1)", [agenda]);
    expect(a.roster.map((r) => r.name)).toEqual(["Ahmad", "Budi"]);
    expect(a.roster.every((r) => r.can_write)).toBe(true);
    expect(await rpc("adminKelB1", "public.mobile_agenda($1)", [agenda])).toBeNull();
  });

  it("checklist menimpa, pemindai mempertahankan catatan pertama", async () => {
    await rpc("adminDesaA", "public.mobile_save_attendance($1, $2)", [
      agenda,
      JSON.stringify([{ generus_id: g.Ahmad, status: "hadir", mode: "scan" }]),
    ]);
    await rpc("adminDesaA", "public.mobile_save_attendance($1, $2)", [
      agenda,
      JSON.stringify([{ generus_id: g.Ahmad, status: "terlambat", mode: "scan" }]),
    ]);
    expect((await one<{ status: string; method: string }>(`SELECT status, method FROM attendance WHERE generus_id = $1`, [g.Ahmad]))).toEqual({
      status: "hadir",
      method: "scan",
    });
    await rpc("adminKelA1", "public.mobile_save_attendance($1, $2)", [
      agenda,
      JSON.stringify([{ generus_id: g.Ahmad, status: "izin", mode: "set" }]),
    ]);
    expect((await one<{ status: string; method: string }>(`SELECT status, method FROM attendance WHERE generus_id = $1`, [g.Ahmad]))).toEqual({
      status: "izin",
      method: "delegasi",
    });
  });

  it("presensi di luar lingkup ditolak", async () => {
    await expect(
      rpc("adminKelA1", "public.mobile_save_attendance($1, $2)", [agenda, JSON.stringify([{ generus_id: g.Citra, status: "hadir", mode: "set" }])]),
    ).rejects.toThrow();
  });

  it("roster pemindai berisi hash isi QR untuk pengelola saja", async () => {
    const r = await rpc<{ agenda: { title: string }; rows: { name: string; token_hash: string }[] }>("adminDesaA", "public.mobile_agenda_roster($1)", [agenda]);
    expect(r.agenda.title).toBe("Pengajian Desa A");
    const { qr_token } = await one<{ qr_token: string }>(`SELECT qr_token FROM generus WHERE id = $1`, [g.Budi]);
    expect(r.rows.find((x) => x.name === "Budi")?.token_hash).toBe(createHash("sha256").update(`GNR1:${qr_token}`).digest("hex"));
    await expect(rpc("petugas", "public.mobile_agenda_roster($1)", [agenda])).rejects.toThrow();
  });

  it("membatalkan agenda hanya oleh pengelola", async () => {
    const extra = (
      await one<{ id: string }>(
        `INSERT INTO agendas (unit_id, title, starts_at, ends_at, late_after, delegate_until)
         VALUES ($1, 'Agenda batal', now() + interval '1 day', now() + interval '1 day 2 hour', now() + interval '1 day', now() + interval '3 day') RETURNING id`,
        [unit.desaA],
      )
    ).id;
    expect(await rpc("adminKelA1", "public.mobile_cancel_agenda($1)", [extra])).toBe(0);
    expect(await rpc("adminDesaA", "public.mobile_cancel_agenda($1)", [extra])).toBe(1);
  });
});

describe("generus", () => {
  it("daftar mengikuti lingkup dan filter", async () => {
    const all = await rpc<{ rows: { name: string }[]; total: number }>("adminDesaA", "public.mobile_generus_list()");
    expect(all.total).toBe(3);
    const pelajar = await rpc<{ rows: { name: string }[] }>("adminDesaA", "public.mobile_generus_list(p_jenjang => 'Remaja', p_kategori => 'Pelajar')");
    expect(pelajar.rows.map((r) => r.name)).toEqual(["Budi"]);
    const kyai = await rpc<{ total: number }>("kyaiKelA1", "public.mobile_generus_list()");
    expect(kyai.total).toBe(2);
    const cari = await rpc<{ rows: { name: string }[] }>("kyaiKelA1", "public.mobile_generus_list(p_q => 'hma')");
    expect(cari.rows.map((r) => r.name)).toEqual(["Ahmad"]);
    const kur = await rpc<{ total: number }>("kurikulum", "public.mobile_generus_list()");
    expect(kur.total).toBe(0);
  });

  it("token QR hanya untuk admin, bukan kyai", async () => {
    const admin = await rpc<{ qr_token: string | null; can_write: boolean }>("adminKelA1", "public.mobile_generus_detail($1)", [g.Ahmad]);
    expect(admin.qr_token).toMatch(/^[0-9A-F]{16}$/);
    expect(admin.can_write).toBe(true);
    const kyai = await rpc<{ qr_token: string | null; can_write: boolean }>("kyaiKelA1", "public.mobile_generus_detail($1)", [g.Ahmad]);
    expect(kyai.qr_token).toBeNull();
    expect(kyai.can_write).toBe(false);
  });

  it("terbitkan ulang kartu mengganti token; kyai ditolak", async () => {
    const before = (await one<{ qr_token: string }>(`SELECT qr_token FROM generus WHERE id = $1`, [g.Ahmad])).qr_token;
    await rpc("adminKelA1", "public.mobile_reissue_card($1)", [g.Ahmad]);
    const after = (await one<{ qr_token: string }>(`SELECT qr_token FROM generus WHERE id = $1`, [g.Ahmad])).qr_token;
    expect(after).not.toBe(before);
    await expect(rpc("kyaiKelA1", "public.mobile_reissue_card($1)", [g.Ahmad])).rejects.toThrow();
  });

  it("kartu dan unit lingkup sesuai peran", async () => {
    const cards = await rows<{ name: string }>("adminKelA1", "SELECT * FROM public.mobile_kartu($1)", [unit.desaA]);
    expect(cards.map((c) => c.name)).toEqual(["Ahmad", "Budi"]);
    expect(await rows("kyaiKelA1", "SELECT * FROM public.mobile_kartu($1)", [unit.kelA1])).toEqual([]);
    const mutate = await rows<{ name: string }>("adminDesaA", "SELECT * FROM public.mobile_scope_units('mutate')");
    expect(mutate.map((m) => m.name)).toEqual(["A1", "A2"]);
    expect(await rows("adminKelA1", "SELECT * FROM public.mobile_scope_units('mutate')")).toEqual([]);
  });

  it("kenaikan jenjang massal hanya mengubah yang masih di jenjang asal", async () => {
    const c = await rpc<{ rows: { name: string }[]; truncated: boolean }>("adminDesaA", "public.mobile_promotion_candidates('Pra Remaja', NULL, $1)", [unit.desaA]);
    expect(c.rows.map((r) => r.name).sort()).toEqual(["Ahmad", "Citra"]);
    const n = await rpc("adminDesaA", "public.mobile_promote('Pra Remaja', NULL, 'Remaja', 'Pelajar', $1)", [[g.Citra, g.Budi]]);
    expect(n).toBe(1);
    await expect(rpc("kyaiKelA1", "public.mobile_promote('Pra Remaja', NULL, 'Remaja', 'Pelajar', $1)", [[g.Ahmad]])).resolves.toBe(0);
  });
});

describe("kurikulum & capaian", () => {
  it("target, roster target, dan simpan capaian", async () => {
    const targets = await rpc<{ id: string; kitab: { from: number } | null }[]>("adminKelA1", "public.mobile_targets($1, $2)", [period, j.pra]);
    expect(targets.map((t) => t.id)).toEqual([target, kitabTarget]);
    const roster = await rpc<{ name: string; status: string }[]>("adminKelA1", "public.mobile_target_roster($1, $2)", [target, unit.kelA1]);
    expect(roster).toEqual([expect.objectContaining({ name: "Ahmad", status: "belum" })]);
    await rpc("adminKelA1", "public.mobile_save_achievements($1)", [JSON.stringify([{ target_id: target, generus_id: g.Ahmad, status: "tuntas" }])]);
    const sum = await rpc<{ counts: { id: string; tuntas: number; total: number }[] }>("adminKelA1", "public.mobile_kelompok_summary($1, $2, $3)", [
      period,
      j.pra,
      unit.kelA1,
    ]);
    expect(sum.counts.find((c) => c.id === target)).toMatchObject({ total: 1, tuntas: 1 });
    await expect(
      rpc("kyaiKelA1", "public.mobile_save_achievements($1)", [JSON.stringify([{ target_id: target, generus_id: g.Ahmad, status: "proses" }])]),
    ).rejects.toThrow();
    await rpc("adminKelA1", "public.mobile_save_achievements($1)", [JSON.stringify([{ target_id: target, generus_id: g.Ahmad, status: "belum" }])]);
    expect((await one<{ n: number }>(`SELECT count(*)::int n FROM achievements`)).n).toBe(0);
  });

  it("progres kitab: catatan ulang di hari yang sama menggantikan", async () => {
    await rpc("adminKelA1", "public.mobile_save_kitab_progress($1, $2, 12, current_date)", [kitab, [g.Ahmad]]);
    await rpc("adminKelA1", "public.mobile_save_kitab_progress($1, $2, 25, current_date)", [kitab, [g.Ahmad]]);
    expect((await db.query(`SELECT position FROM kitab_progress WHERE generus_id = $1`, [g.Ahmad])).rows).toEqual([{ position: 25 }]);
    const cap = await rpc<{ rows: { target_id: string; position: number | null }[] }>("adminKelA1", "public.mobile_generus_capaian($1, $2)", [g.Ahmad, period]);
    expect(cap.rows.find((r) => r.target_id === kitabTarget)?.position).toBe(25);
    await expect(rpc("kyaiKelA1", "public.mobile_save_kitab_progress($1, $2, 30, current_date)", [kitab, [g.Ahmad]])).rejects.toThrow();
  });

  it("periode baru menyalin target; geser target dalam aspek", async () => {
    const id = await rpc<string>("kurikulum", "public.mobile_create_period('November', '1-2026', current_date + 21, current_date + 50, $1)", [period]);
    const copied = await rpc<{ id: string; mapel: string }[]>("kurikulum", "public.mobile_targets($1, $2)", [id, j.pra]);
    expect(copied.map((t) => t.mapel)).toEqual(["Hafalan", "Bacaan"]);
    await rpc("kurikulum", "public.mobile_move_target($1, true)", [copied[1].id]);
    const moved = await rpc<{ mapel: string }[]>("kurikulum", "public.mobile_targets($1, $2)", [id, j.pra]);
    expect(moved.map((t) => t.mapel)).toEqual(["Bacaan", "Hafalan"]);
    await expect(rpc("adminDesaA", "public.mobile_create_period('X', '1', current_date, current_date)")).rejects.toThrow();
  });

  it("pustaka, kitab, mapel, dan rekap bisa dibaca", async () => {
    expect(await rows<{ used_in: number }>("kurikulum", "SELECT * FROM public.mobile_materi()")).toEqual([expect.objectContaining({ used_in: 2 })]);
    const kitabRows = await rows<{ id: string; max_to: number; used_in: number }>("kurikulum", "SELECT * FROM public.mobile_kitab()");
    expect(kitabRows.find((k) => k.id === kitab)).toMatchObject({ max_to: 20, used_in: 2 });
    expect((await rows("kurikulum", "SELECT * FROM public.mobile_mapel_names()")).length).toBe(2);
    expect((await rows("kurikulum", "SELECT * FROM public.mobile_rekap_units($1, NULL, $2)", [period, [unit.daerah]])).length).toBe(1);
    expect((await rows("kurikulum", "SELECT * FROM public.mobile_rekap_targets($1, $2, $3)", [period, j.pra, unit.daerah])).length).toBe(2);
    expect((await rows<{ rel: string }>("adminKelA1", "SELECT * FROM public.mobile_unit_with_children($1)", [unit.desaA])).map((r) => r.rel).sort()).toEqual([
      "anc",
      "child",
      "child",
      "self",
    ]);
  });
});

describe("laporan & admin", () => {
  it("laporan mengikuti hak baca; kurikulum ditolak", async () => {
    const from = "2000-01-01T00:00:00Z";
    const to = "2100-01-01T00:00:00Z";
    expect((await rows("adminDesaA", "SELECT * FROM public.mobile_kehadiran_units($1, $2, $3)", [from, to, [unit.desaA]])).length).toBe(1);
    expect((await rpc<unknown[]>("adminDesaA", "public.mobile_laporan_generus($1, $2, $3, NULL)", [from, to, unit.desaA])).length).toBeGreaterThan(0);
    await expect(rpc("kurikulum", "public.mobile_laporan_generus($1, $2, $3, NULL)", [from, to, unit.desaA])).rejects.toThrow();
    expect(await rows("adminDesaA", "SELECT * FROM public.mobile_peringatan_alpa($1)", [unit.desaA])).toEqual([]);
    expect((await rows("adminDesaA", "SELECT * FROM public.mobile_kehadiran_tren($1, $2, $3, 'Asia/Jakarta')", [unit.desaA, from, to])).length).toBeGreaterThanOrEqual(0);
    expect((await rows<{ name: string }>("kyaiKelA1", "SELECT * FROM public.mobile_kelompok_under($1)", [unit.desaA])).map((r) => r.name)).toEqual(["A1", "A2"]);
  });

  it("akun lengkap hanya untuk superadmin", async () => {
    const all = await rpc<unknown[]>("superadmin", "public.mobile_accounts()");
    expect(all.length).toBe(7);
    const self = await rpc<{ id: string }[]>("kyaiKelA1", "public.mobile_accounts()");
    expect(self.map((a) => a.id)).toEqual([u.kyaiKelA1]);
    expect(await rpc("superadmin", "public.mobile_is_superadmin()")).toBe(true);
    expect(await rpc("adminDesaA", "public.mobile_is_superadmin()")).toBe(false);
    expect((await rows("superadmin", "SELECT * FROM public.mobile_wilayah()")).length).toBe(6);
    expect((await rows("adminDesaA", "SELECT * FROM public.mobile_agenda_units()")).length).toBe(3);
  });

  it("kunci agenda: ditolak sebelum selesai, kunci otomatis tidak error", async () => {
    await expect(rpc("adminDesaA", "public.mobile_lock_agenda($1)", [agenda])).rejects.toThrow(/setelah agenda selesai/);
    await rpc("adminDesaA", "public.mobile_lock_due_agendas()");
    const att = await rpc<{ rows: unknown[]; stats: { total: number } }>("adminKelA1", "public.mobile_generus_attendance($1)", [g.Ahmad]);
    expect(att.rows.length).toBe(1);
  });
});
