import "server-only";
import { sql } from "drizzle-orm";
import { withRls, type JwtClaims } from "@/db/rls";
import { listPeriods, listTargets, type PeriodListItem, type TargetRow } from "@/lib/kurikulum";
import type { CapaianStatus } from "@/lib/kurikulum-format";

/** Tanggal hari ini di zona aplikasi (YYYY-MM-DD). */
export function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Jakarta" });
}

/** Periode terbit yang sedang berjalan; bila tidak ada, periode terbit terakhir yang sudah dimulai. */
export function pickActivePeriod(periods: PeriodListItem[], today = todayIso()): PeriodListItem | null {
  const published = periods.filter((p) => p.publishedAt);
  return (
    published.find((p) => p.startsOn <= today && today <= p.endsOn) ??
    published.find((p) => p.startsOn <= today) ??
    published.at(-1) ??
    null
  );
}

export async function listPublishedPeriods(claims: JwtClaims): Promise<PeriodListItem[]> {
  return (await listPeriods(claims)).filter((p) => p.publishedAt);
}

export interface TargetSummary extends TargetRow {
  /** Generus sasaran di kelompok ini. */
  total: number;
  tuntas: number;
  proses: number;
  delivery: { deliveredOn: string; note: string | null } | null;
}

/**
 * Target satu jenjang beserta rekap capaian satu kelompok. Untuk target kitab,
 * tuntas/proses dihitung dari posisi terakhir yang tercatat sampai akhir periode.
 */
export async function getKelompokSummary(
  claims: JwtClaims,
  periodId: string,
  jenjangId: string,
  kelompokId: string,
): Promise<TargetSummary[]> {
  const targets = await listTargets(claims, periodId, jenjangId);
  if (targets.length === 0) return [];
  const [counts, deliveries] = await withRls(claims, async (tx) => [
    await tx.execute<{ id: string; total: number; tuntas: number; proses: number }>(sql`
      SELECT t.id,
        count(g.id)::int AS total,
        count(g.id) FILTER (WHERE CASE WHEN t.kitab_id IS NULL THEN a.status = 'tuntas' ELSE kp.position >= t.range_to END)::int AS tuntas,
        count(g.id) FILTER (WHERE CASE WHEN t.kitab_id IS NULL THEN a.status = 'proses'
                                       ELSE kp.position >= t.range_from AND kp.position < t.range_to END)::int AS proses
      FROM period_targets t
      JOIN curriculum_periods p ON p.id = t.period_id
      LEFT JOIN generus g ON g.kelompok_id = ${kelompokId} AND app.target_applies(t, g)
      LEFT JOIN achievements a ON a.target_id = t.id AND a.generus_id = g.id
      LEFT JOIN LATERAL (
        SELECT x.position FROM kitab_progress x
        WHERE x.generus_id = g.id AND x.kitab_id = t.kitab_id AND x.recorded_on <= p.ends_on
        ORDER BY x.recorded_on DESC, x.created_at DESC LIMIT 1
      ) kp ON t.kitab_id IS NOT NULL
      WHERE t.period_id = ${periodId} AND t.jenjang_id = ${jenjangId}
      GROUP BY t.id`),
    await tx.execute<{ target_id: string; delivered_on: string; note: string | null }>(sql`
      SELECT d.target_id, d.delivered_on::text, d.note
      FROM target_deliveries d JOIN period_targets t ON t.id = d.target_id
      WHERE d.kelompok_id = ${kelompokId} AND t.period_id = ${periodId}`),
  ]);
  const byId = new Map(counts.map((c) => [c.id, c]));
  const delivered = new Map(deliveries.map((d) => [d.target_id, { deliveredOn: d.delivered_on, note: d.note }]));
  return targets.map((t) => {
    const c = byId.get(t.id);
    return { ...t, total: c?.total ?? 0, tuntas: c?.tuntas ?? 0, proses: c?.proses ?? 0, delivery: delivered.get(t.id) ?? null };
  });
}

export interface RosterEntry {
  generusId: string;
  name: string;
  gender: "L" | "P";
  kategori: string | null;
  aktif: boolean;
  status: CapaianStatus;
  note: string | null;
  /** Posisi kitab terakhir (target kitab). */
  position: number | null;
  recordedOn: string | null;
}

/** Generus sasaran satu target di satu kelompok, beserta capaian/posisi terakhirnya. */
export async function getTargetRoster(claims: JwtClaims, targetId: string, kelompokId: string): Promise<RosterEntry[]> {
  const rows = await withRls(claims, (tx) =>
    tx.execute<{
      id: string;
      name: string;
      gender: "L" | "P";
      kategori: string | null;
      aktif: boolean;
      status: CapaianStatus | null;
      note: string | null;
      position: number | null;
      recorded_on: string | null;
    }>(sql`
      SELECT g.id, g.name, g.gender, k.name AS kategori, g.status = 'aktif' AS aktif,
             a.status, a.note, kp.position, kp.recorded_on::text
      FROM period_targets t
      JOIN curriculum_periods p ON p.id = t.period_id
      JOIN generus g ON g.kelompok_id = ${kelompokId} AND app.target_applies(t, g)
      LEFT JOIN jenjang_kategori k ON k.id = g.kategori_id
      LEFT JOIN achievements a ON a.target_id = t.id AND a.generus_id = g.id
      LEFT JOIN LATERAL (
        SELECT x.position, x.recorded_on FROM kitab_progress x
        WHERE x.generus_id = g.id AND x.kitab_id = t.kitab_id AND x.recorded_on <= p.ends_on
        ORDER BY x.recorded_on DESC, x.created_at DESC LIMIT 1
      ) kp ON t.kitab_id IS NOT NULL
      WHERE t.id = ${targetId}
      ORDER BY g.name`),
  );
  return rows.map((r) => ({
    generusId: r.id,
    name: r.name,
    gender: r.gender,
    kategori: r.kategori,
    aktif: r.aktif,
    status: r.status ?? "belum",
    note: r.note,
    position: r.position,
    recordedOn: r.recorded_on,
  }));
}

/** Satu target beserta periodenya (null bila tidak terlihat). */
export async function getTarget(claims: JwtClaims, targetId: string): Promise<(TargetRow & { periodId: string }) | null> {
  const [ref] = await withRls(claims, (tx) =>
    tx.execute<{ period_id: string; jenjang_id: string }>(
      sql`SELECT period_id, jenjang_id FROM period_targets WHERE id = ${targetId}`,
    ),
  );
  if (!ref) return null;
  const t = (await listTargets(claims, ref.period_id, ref.jenjang_id)).find((x) => x.id === targetId);
  return t ? { ...t, periodId: ref.period_id } : null;
}

export interface GenerusCapaian extends TargetRow {
  status: CapaianStatus;
  note: string | null;
  position: number | null;
  recordedOn: string | null;
  deliveredOn: string | null;
}

/** Semua target periode yang berlaku untuk satu generus, beserta capaiannya. */
export async function getGenerusCapaian(claims: JwtClaims, generusId: string, periodId: string): Promise<GenerusCapaian[]> {
  const [g] = await withRls(claims, (tx) =>
    tx.execute<{ jenjang_id: string; kelompok_id: string }>(sql`SELECT jenjang_id, kelompok_id FROM generus WHERE id = ${generusId}`),
  );
  if (!g) return [];
  const targets = await listTargets(claims, periodId, g.jenjang_id);
  const rows = await withRls(claims, (tx) =>
    tx.execute<{ id: string; status: CapaianStatus | null; note: string | null; position: number | null; recorded_on: string | null; delivered_on: string | null }>(sql`
      SELECT t.id, a.status, a.note, kp.position, kp.recorded_on::text, d.delivered_on::text
      FROM period_targets t
      JOIN curriculum_periods p ON p.id = t.period_id
      JOIN generus g ON g.id = ${generusId} AND app.target_applies(t, g)
      LEFT JOIN achievements a ON a.target_id = t.id AND a.generus_id = g.id
      LEFT JOIN target_deliveries d ON d.target_id = t.id AND d.kelompok_id = g.kelompok_id
      LEFT JOIN LATERAL (
        SELECT x.position, x.recorded_on FROM kitab_progress x
        WHERE x.generus_id = g.id AND x.kitab_id = t.kitab_id AND x.recorded_on <= p.ends_on
        ORDER BY x.recorded_on DESC, x.created_at DESC LIMIT 1
      ) kp ON t.kitab_id IS NOT NULL
      WHERE t.period_id = ${periodId}`),
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  return targets
    .filter((t) => byId.has(t.id))
    .map((t) => {
      const r = byId.get(t.id)!;
      return { ...t, status: r.status ?? "belum", note: r.note, position: r.position, recordedOn: r.recorded_on, deliveredOn: r.delivered_on };
    });
}

// ---------------------------------------------------------------------------
// Rekap lintas unit (agregat, lewat fungsi SECURITY DEFINER app.capaian_rekap_*)
// ---------------------------------------------------------------------------

export interface RekapUnit {
  unitId: string;
  generus: number;
  /** Pasangan (target, generus) yang dinilai per generus/kitab, tanpa target pilihan. */
  slots: number;
  tuntas: number;
  proses: number;
  kelompok: number;
  delivered: number;
  deliverable: number;
}

export async function getRekapUnits(claims: JwtClaims, periodId: string, jenjangId: string | null, unitIds: string[]): Promise<RekapUnit[]> {
  if (unitIds.length === 0) return [];
  const rows = await withRls(claims, (tx) =>
    tx.execute<{ unit_id: string; generus: number; slots: number; tuntas: number; proses: number; kelompok: number; delivered: number; deliverable: number }>(
      sql`SELECT * FROM app.capaian_rekap_units(${periodId}::uuid, ${jenjangId}::uuid, ${`{${unitIds.join(",")}}`}::uuid[])`,
    ),
  );
  return rows.map((r) => ({
    unitId: r.unit_id,
    generus: r.generus,
    slots: r.slots,
    tuntas: r.tuntas,
    proses: r.proses,
    kelompok: r.kelompok,
    delivered: r.delivered,
    deliverable: r.deliverable,
  }));
}

export type RekapTarget = {
  slots: number;
  tuntas: number;
  proses: number;
  delivered: number;
  kelompok: number;
};

export async function getRekapTargets(claims: JwtClaims, periodId: string, jenjangId: string, unitId: string): Promise<Map<string, RekapTarget>> {
  const rows = await withRls(claims, (tx) =>
    tx.execute<{ target_id: string } & RekapTarget>(sql`SELECT * FROM app.capaian_rekap_targets(${periodId}::uuid, ${jenjangId}::uuid, ${unitId}::uuid)`),
  );
  return new Map(rows.map(({ target_id, ...r }) => [target_id, r]));
}

export interface UnitNode {
  id: string;
  name: string;
  level: "daerah" | "desa" | "kelompok";
  parentId: string | null;
}

/** Unit beserta leluhurnya (untuk breadcrumb) dan anak langsungnya. Nama unit boleh dibaca semua akun. */
export async function getUnitWithChildren(claims: JwtClaims, unitId: string): Promise<{ unit: UnitNode; ancestors: UnitNode[]; children: UnitNode[] } | null> {
  return withRls(claims, async (tx) => {
    const rows = await tx.execute<{ id: string; name: string; level: UnitNode["level"]; parent_id: string | null; rel: "self" | "anc" | "child" }>(sql`
      WITH me AS (SELECT path FROM units WHERE id = ${unitId})
      SELECT u.id, u.name, u.level, u.parent_id,
        CASE WHEN u.id = ${unitId} THEN 'self' WHEN u.parent_id = ${unitId} THEN 'child' ELSE 'anc' END AS rel
      FROM units u, me
      WHERE u.id = ${unitId} OR u.parent_id = ${unitId} OR me.path <@ u.path
      ORDER BY nlevel(u.path), u.name`);
    const map = (r: (typeof rows)[number]): UnitNode => ({ id: r.id, name: r.name, level: r.level, parentId: r.parent_id });
    const self = rows.find((r) => r.rel === "self");
    if (!self) return null;
    return {
      unit: map(self),
      ancestors: rows.filter((r) => r.rel === "anc").map(map),
      children: rows.filter((r) => r.rel === "child").map(map),
    };
  });
}
