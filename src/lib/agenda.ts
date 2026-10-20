import "server-only";
import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { agendas, attendance, units } from "@/db/schema";
import { withRls, type JwtClaims } from "@/db/rls";

// Query agenda & presensi. Semua lewat RLS.

export type AttendanceStatus = "hadir" | "terlambat" | "izin" | "sakit" | "alpa";

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  hadir: "Hadir",
  terlambat: "Terlambat",
  izin: "Izin",
  sakit: "Sakit",
  alpa: "Alpa",
};
export const ATTENDANCE_STATUSES = Object.keys(ATTENDANCE_LABEL) as AttendanceStatus[];

export const AGENDA_PAGE_SIZE = 30;

export interface AgendaListItem {
  id: string;
  title: string;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  unitName: string;
  level: "daerah" | "desa" | "kelompok";
  lockedAt: Date | null;
  cancelledAt: Date | null;
}

const agendaColumns = {
  id: agendas.id,
  title: agendas.title,
  location: agendas.location,
  startsAt: agendas.startsAt,
  endsAt: agendas.endsAt,
  unitName: units.name,
  level: units.level,
  lockedAt: agendas.lockedAt,
  cancelledAt: agendas.cancelledAt,
};

/** Agenda yang terlihat user: mendatang (urut terdekat) atau selesai (urut terbaru). */
export async function listAgendas(
  claims: JwtClaims,
  range: "mendatang" | "selesai",
  page = 1,
): Promise<{ rows: AgendaListItem[]; hasMore: boolean }> {
  return withRls(claims, async (tx) => {
    const now = new Date();
    const rows = await tx
      .select(agendaColumns)
      .from(agendas)
      .innerJoin(units, eq(units.id, agendas.unitId))
      .where(range === "mendatang" ? gte(agendas.endsAt, now) : lt(agendas.endsAt, now))
      .orderBy(range === "mendatang" ? asc(agendas.startsAt) : desc(agendas.startsAt))
      .limit(AGENDA_PAGE_SIZE + 1)
      .offset((page - 1) * AGENDA_PAGE_SIZE);
    return { rows: rows.slice(0, AGENDA_PAGE_SIZE), hasMore: rows.length > AGENDA_PAGE_SIZE };
  });
}

/** Kunci agenda yang sudah lewat batas (idempoten). Pengaman bila jadwal pg_cron belum aktif. */
export async function lockDueAgendas(claims: JwtClaims): Promise<void> {
  await withRls(claims, (tx) => tx.execute(sql`SELECT app.lock_due_agendas()`));
}

export interface AgendaDetail extends AgendaListItem {
  unitId: string;
  lateAfter: Date;
  delegateUntil: Date;
  targetJenjangIds: string[];
  targetKategoriIds: string[];
  targetGender: "L" | "P" | null;
  recurrenceId: string | null;
  /** User adalah pengelola (admin di unit agenda atau di atasnya). */
  canManage: boolean;
  /** User adalah petugas scan aktif untuk agenda ini. */
  isScanner: boolean;
}

export async function getAgenda(claims: JwtClaims, id: string): Promise<AgendaDetail | null> {
  return withRls(claims, async (tx) => {
    const [a] = await tx
      .select({
        ...agendaColumns,
        unitId: agendas.unitId,
        lateAfter: agendas.lateAfter,
        delegateUntil: agendas.delegateUntil,
        targetJenjangIds: agendas.targetJenjangIds,
        targetKategoriIds: agendas.targetKategoriIds,
        targetGender: agendas.targetGender,
        recurrenceId: agendas.recurrenceId,
        canManage: sql<boolean>`(SELECT app.scope_paths(ARRAY['superadmin','admin']::app_role[])) @> ${agendas.unitPath}`,
        isScanner: sql<boolean>`app.is_agenda_scanner(${agendas.id})`,
      })
      .from(agendas)
      .innerJoin(units, eq(units.id, agendas.unitId))
      .where(eq(agendas.id, id));
    return a ?? null;
  });
}

export interface RosterRow {
  generusId: string;
  name: string;
  gender: "L" | "P";
  kelompok: string;
  desa: string;
  status: AttendanceStatus | null;
  method: string | null;
  recordedAt: Date | null;
  canWrite: boolean;
}

/**
 * Peserta sasaran agenda yang terlihat oleh user, beserta presensinya.
 * Admin kelompok pada agenda desa/daerah otomatis hanya melihat anggotanya
 * (RLS generus), yang sekaligus menjadi daftar delegasinya.
 */
export async function getRoster(claims: JwtClaims, agendaId: string): Promise<RosterRow[]> {
  return withRls(claims, async (tx) => {
    const res = await tx.execute<{
      generus_id: string;
      name: string;
      gender: "L" | "P";
      kelompok: string;
      desa: string;
      status: AttendanceStatus | null;
      method: string | null;
      recorded_at: string | null;
      can_write: boolean;
    }>(sql`
      SELECT g.id AS generus_id, g.name, g.gender, k.name AS kelompok, d.name AS desa,
             at.status, at.method, at.recorded_at,
             app.can_write_attendance(a.id, g.id) AS can_write
      FROM agendas a
      JOIN generus g ON app.agenda_is_target(a, g)
      JOIN units k ON k.id = g.kelompok_id
      JOIN units d ON d.id = k.parent_id
      LEFT JOIN attendance at ON at.agenda_id = a.id AND at.generus_id = g.id
      WHERE a.id = ${agendaId}
      UNION ALL
      -- Presensi yang tersimpan untuk generus yang kini bukan sasaran (mis. agenda diubah).
      SELECT g.id, g.name, g.gender, k.name, d.name, at.status, at.method, at.recorded_at,
             app.can_write_attendance(at.agenda_id, g.id)
      FROM attendance at
      JOIN agendas a ON a.id = at.agenda_id
      JOIN generus g ON g.id = at.generus_id
      JOIN units k ON k.id = g.kelompok_id
      JOIN units d ON d.id = k.parent_id
      WHERE at.agenda_id = ${agendaId} AND NOT app.agenda_is_target(a, g)
      ORDER BY desa, kelompok, name`);
    return res.map((r) => ({
      generusId: r.generus_id,
      name: r.name,
      gender: r.gender,
      kelompok: r.kelompok,
      desa: r.desa,
      status: r.status,
      method: r.method,
      recordedAt: r.recorded_at ? new Date(r.recorded_at) : null,
      canWrite: r.can_write,
    }));
  });
}

export interface AttendanceSummary {
  total: number;
  counts: Record<AttendanceStatus | "belum", number>;
  /** (hadir + terlambat) / total, 0–1. */
  rate: number;
}

export function summarize(rows: Pick<RosterRow, "status">[]): AttendanceSummary {
  const counts = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0, belum: 0 };
  for (const r of rows) counts[r.status ?? "belum"]++;
  const total = rows.length;
  return { total, counts, rate: total ? (counts.hadir + counts.terlambat) / total : 0 };
}

export interface GenerusAttendanceItem {
  agendaId: string;
  title: string;
  startsAt: Date;
  unitName: string;
  status: AttendanceStatus;
}

/** Riwayat presensi satu generus (terbaru dulu). */
export async function getGenerusAttendance(claims: JwtClaims, generusId: string, limit = 20) {
  return withRls(claims, async (tx) => {
    const rows = await tx
      .select({
        agendaId: agendas.id,
        title: agendas.title,
        startsAt: agendas.startsAt,
        unitName: units.name,
        status: attendance.status,
      })
      .from(attendance)
      .innerJoin(agendas, eq(agendas.id, attendance.agendaId))
      .innerJoin(units, eq(units.id, agendas.unitId))
      .where(and(eq(attendance.generusId, generusId), isNull(agendas.cancelledAt)))
      .orderBy(desc(agendas.startsAt))
      .limit(limit);
    const [stats] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        hadir: sql<number>`count(*) FILTER (WHERE ${attendance.status} IN ('hadir','terlambat'))::int`,
        alpa: sql<number>`count(*) FILTER (WHERE ${attendance.status} = 'alpa')::int`,
      })
      .from(attendance)
      .innerJoin(agendas, eq(agendas.id, attendance.agendaId))
      .where(and(eq(attendance.generusId, generusId), isNull(agendas.cancelledAt), sql`${agendas.lockedAt} IS NOT NULL`));
    return { rows, stats };
  });
}

/** Unit tempat user boleh membuat agenda (admin/superadmin), urut hierarki. */
export async function listAgendaUnits(claims: JwtClaims) {
  return withRls(claims, async (tx) => {
    const res = await tx.execute<{ id: string; name: string; level: "daerah" | "desa" | "kelompok"; parent_name: string | null }>(sql`
      SELECT u.id, u.name, u.level, p.name AS parent_name
      FROM units u LEFT JOIN units p ON p.id = u.parent_id
      WHERE u.path <@ (SELECT app.scope_paths(ARRAY['superadmin','admin']::app_role[]))
      ORDER BY u.level, coalesce(p.name, ''), u.name`);
    return res.map((r) => ({ id: r.id, name: r.name, level: r.level, parentName: r.parent_name }));
  });
}


export interface ScannerRow {
  userId: string;
  name: string;
  email: string | null;
  expiresAt: Date;
}

/** Petugas scan sebuah agenda (hanya terlihat oleh pengelola). */
export async function listScanners(claims: JwtClaims, agendaId: string): Promise<ScannerRow[]> {
  return withRls(claims, async (tx) => {
    const rows = await tx.execute<{ user_id: string; name: string; email: string | null; expires_at: string }>(sql`
      SELECT s.user_id, p.name, p.email, s.expires_at
      FROM agenda_scanners s JOIN profiles p ON p.id = s.user_id
      WHERE s.agenda_id = ${agendaId}
      ORDER BY p.name`);
    return rows.map((r) => ({ userId: r.user_id, name: r.name, email: r.email, expiresAt: new Date(r.expires_at) }));
  });
}

/** Akun yang bisa dijadikan petugas: akun aktif yang terlihat oleh pengelola. */
export async function listScannerCandidates(claims: JwtClaims): Promise<{ id: string; name: string; email: string | null }[]> {
  return withRls(claims, async (tx) => {
    const rows = await tx.execute<{ id: string; name: string; email: string | null }>(sql`
      SELECT id, name, email FROM profiles WHERE active AND id <> auth.uid() ORDER BY name`);
    return [...rows];
  });
}

/** Agenda di mana user menjadi petugas scan aktif (untuk beranda). */
export async function listMyScanTasks(claims: JwtClaims) {
  return withRls(claims, async (tx) => {
    const rows = await tx.execute<{ id: string; title: string; starts_at: string; unit_name: string; locked_at: string | null }>(sql`
      SELECT a.id, a.title, a.starts_at, u.name AS unit_name, a.locked_at
      FROM agenda_scanners s
      JOIN agendas a ON a.id = s.agenda_id
      JOIN units u ON u.id = a.unit_id
      WHERE s.user_id = auth.uid() AND s.expires_at > now() AND a.cancelled_at IS NULL AND a.locked_at IS NULL
      ORDER BY a.starts_at`);
    return rows.map((r) => ({ id: r.id, title: r.title, startsAt: new Date(r.starts_at), unitName: r.unit_name }));
  });
}

export interface HeroAgenda {
  id: string;
  title: string;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  unitName: string;
  level: "daerah" | "desa" | "kelompok";
  ongoing: boolean;
  /** Peserta sasaran yang terlihat user & yang sudah tercatat (hadir/terlambat). */
  targets: number;
  present: number;
  canManage: boolean;
  isScanner: boolean;
}

export interface BerandaSummary {
  hero: HeroAgenda | null;
  month: { agendas: number; locked: number; rate: number | null; alpaStreak: number };
}

/** Data beranda: agenda berlangsung/berikutnya + ringkasan kehadiran bulan berjalan. */
export async function getBerandaSummary(claims: JwtClaims): Promise<BerandaSummary> {
  return withRls(claims, async (tx) => {
    const [a] = await tx.execute<{
      id: string; title: string; location: string | null; starts_at: string; ends_at: string;
      unit_name: string; level: HeroAgenda["level"]; targets: number; present: number; can_manage: boolean; is_scanner: boolean;
    }>(sql`
      SELECT a.id, a.title, a.location, a.starts_at, a.ends_at, u.name AS unit_name, u.level,
             (SELECT count(*)::int FROM generus g WHERE app.agenda_is_target(a, g)) AS targets,
             (SELECT count(*)::int FROM attendance at WHERE at.agenda_id = a.id AND at.status IN ('hadir','terlambat')) AS present,
             app.can_manage_agenda(a.id) AS can_manage,
             app.is_agenda_scanner(a.id) AS is_scanner
      FROM agendas a JOIN units u ON u.id = a.unit_id
      WHERE a.cancelled_at IS NULL AND a.ends_at >= now()
      ORDER BY a.starts_at
      LIMIT 1`);
    const [m] = await tx.execute<{ agendas: number; locked: number; present: number; total: number }>(sql`
      SELECT count(DISTINCT a.id)::int AS agendas,
             count(DISTINCT a.id) FILTER (WHERE a.locked_at IS NOT NULL)::int AS locked,
             count(at.*) FILTER (WHERE a.locked_at IS NOT NULL AND at.status IN ('hadir','terlambat'))::int AS present,
             count(at.*) FILTER (WHERE a.locked_at IS NOT NULL)::int AS total
      FROM agendas a LEFT JOIN attendance at ON at.agenda_id = a.id
      WHERE a.cancelled_at IS NULL AND a.starts_at >= date_trunc('month', now()) AND a.starts_at < date_trunc('month', now()) + interval '1 month'`);
    // Generus dengan 3 agenda terkunci terakhirnya berstatus alpa (PRD F-43).
    const [s] = await tx.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM (
        SELECT at.generus_id, bool_and(at.status = 'alpa') AS all_alpa, count(*) AS c
        FROM (
          SELECT at.generus_id, at.status,
                 row_number() OVER (PARTITION BY at.generus_id ORDER BY a.starts_at DESC) AS rn
          FROM attendance at JOIN agendas a ON a.id = at.agenda_id
          WHERE a.locked_at IS NOT NULL AND a.cancelled_at IS NULL
        ) at WHERE at.rn <= 3 GROUP BY at.generus_id
      ) x WHERE x.all_alpa AND x.c = 3`);
    const now = Date.now();
    return {
      hero: a
        ? {
            id: a.id,
            title: a.title,
            location: a.location,
            startsAt: new Date(a.starts_at),
            endsAt: new Date(a.ends_at),
            unitName: a.unit_name,
            level: a.level,
            ongoing: new Date(a.starts_at).getTime() <= now,
            targets: a.targets,
            present: a.present,
            canManage: a.can_manage,
            isScanner: a.is_scanner,
          }
        : null,
      month: { agendas: m.agendas, locked: m.locked, rate: m.total ? m.present / m.total : null, alpaStreak: s.n },
    };
  });
}
