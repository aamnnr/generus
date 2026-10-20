import "server-only";
import { sql } from "drizzle-orm";
import { withRls, type JwtClaims } from "@/db/rls";
import type { CurrentUser, UserRole } from "@/lib/auth";
import { APP_TIMEZONE, zonedToUtc } from "@/lib/time";

// Laporan bulanan (Fase 5). Agregat lewat fungsi app.kehadiran_* / app.laporan_generus
// yang memeriksa lingkup user (superadmin/admin/kyai; Tim Kurikulum tidak).

/** Unit tertinggi tempat user boleh melihat laporan presensi (bukan peran kurikulum). */
export function laporanRootUnit(user: CurrentUser): UserRole | null {
  const rank = { daerah: 0, desa: 1, kelompok: 2 } as const;
  return [...user.roles].filter((r) => r.role !== "kurikulum").sort((a, b) => rank[a.level] - rank[b.level])[0] ?? null;
}

/** "2026-10" → rentang [awal bulan, awal bulan berikutnya) di zona aplikasi. */
export function monthRange(ym: string): { from: Date; to: Date; label: string; startIso: string; endIso: string } {
  const [y, m] = ym.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: zonedToUtc(`${ym}-01`, "00:00"),
    to: zonedToUtc(`${next}-01`, "00:00"),
    label: monthLabel(ym),
    startIso: `${ym}-01`,
    endIso: `${ym}-${String(last).padStart(2, "0")}`,
  };
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Bulan berjalan (YYYY-MM) di zona aplikasi. */
export function currentMonth(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE }).slice(0, 7);
}

/** `n` bulan terakhir, terbaru dulu. */
export function recentMonths(n: number, from = currentMonth()): string[] {
  const [y, m] = from.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

export interface KehadiranUnit {
  unitId: string;
  generus: number;
  agendas: number;
  total: number;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alpa: number;
}

/** Persentase hadir (termasuk terlambat) dari seluruh presensi agenda terkunci. */
export const hadirRate = (r: Pick<KehadiranUnit, "total" | "hadir" | "terlambat">) =>
  r.total > 0 ? Math.round(((r.hadir + r.terlambat) / r.total) * 100) : null;

export async function getKehadiranUnits(claims: JwtClaims, from: Date, to: Date, unitIds: string[]): Promise<KehadiranUnit[]> {
  if (unitIds.length === 0) return [];
  const rows = await withRls(claims, (tx) =>
    tx.execute<{ unit_id: string } & Omit<KehadiranUnit, "unitId">>(
      sql`SELECT * FROM app.kehadiran_rekap_units(${from.toISOString()}::timestamptz, ${to.toISOString()}::timestamptz, ${`{${unitIds.join(",")}}`}::uuid[])`,
    ),
  );
  return rows.map(({ unit_id, ...r }) => ({ unitId: unit_id, ...r }));
}

export async function getKehadiranTren(claims: JwtClaims, unitId: string, months: string[]): Promise<{ month: string; rate: number | null; total: number }[]> {
  const sorted = [...months].sort();
  const from = monthRange(sorted[0]).from;
  const to = monthRange(sorted.at(-1)!).to;
  const rows = await withRls(claims, (tx) =>
    tx.execute<{ bulan: string; total: number; hadir: number }>(
      sql`SELECT bulan::text, total, hadir FROM app.kehadiran_tren(${unitId}::uuid, ${from.toISOString()}::timestamptz, ${to.toISOString()}::timestamptz, ${APP_TIMEZONE})`,
    ),
  );
  const by = new Map(rows.map((r) => [r.bulan.slice(0, 7), r]));
  return sorted.map((m) => {
    const r = by.get(m);
    return { month: m, total: r?.total ?? 0, rate: r && r.total ? Math.round((r.hadir / r.total) * 100) : null };
  });
}

export interface LaporanGenerusRow {
  generusId: string;
  name: string;
  gender: "L" | "P";
  kelompok: string;
  desa: string;
  jenjang: string;
  kategori: string | null;
  status: "aktif" | "pindah_sambung" | "menikah";
  total: number;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alpa: number;
  capSlots: number;
  capTuntas: number;
  alpaStreak: boolean;
}

export async function getLaporanGenerus(claims: JwtClaims, from: Date, to: Date, unitId: string, periodId: string | null): Promise<LaporanGenerusRow[]> {
  const rows = await withRls(claims, (tx) =>
    tx.execute<{
      generus_id: string; name: string; gender: "L" | "P"; kelompok: string; desa: string; jenjang: string; kategori: string | null;
      status: LaporanGenerusRow["status"]; total: number; hadir: number; terlambat: number; izin: number; sakit: number; alpa: number;
      cap_slots: number; cap_tuntas: number; alpa_streak: boolean;
    }>(
      sql`SELECT * FROM app.laporan_generus(${from.toISOString()}::timestamptz, ${to.toISOString()}::timestamptz, ${unitId}::uuid, ${periodId}::uuid)`,
    ),
  );
  return rows.map((r) => ({
    generusId: r.generus_id,
    name: r.name,
    gender: r.gender,
    kelompok: r.kelompok,
    desa: r.desa,
    jenjang: r.jenjang,
    kategori: r.kategori,
    status: r.status,
    total: r.total,
    hadir: r.hadir,
    terlambat: r.terlambat,
    izin: r.izin,
    sakit: r.sakit,
    alpa: r.alpa,
    capSlots: r.cap_slots,
    capTuntas: r.cap_tuntas,
    alpaStreak: r.alpa_streak,
  }));
}

export async function getPeringatanAlpa(claims: JwtClaims, unitId: string) {
  const rows = await withRls(claims, (tx) =>
    tx.execute<{ generus_id: string; name: string; kelompok: string; kelompok_id: string; last_at: string }>(
      sql`SELECT * FROM app.peringatan_alpa(${unitId}::uuid)`,
    ),
  );
  return rows.map((r) => ({ generusId: r.generus_id, name: r.name, kelompok: r.kelompok, kelompokId: r.kelompok_id, lastAt: new Date(r.last_at) }));
}

/** Semua kelompok di bawah unit (nama unit boleh dibaca semua akun). */
export async function listKelompokUnder(claims: JwtClaims, unitId: string): Promise<{ id: string; name: string }[]> {
  return withRls(claims, (tx) =>
    tx.execute<{ id: string; name: string }>(sql`
      SELECT k.id, k.name FROM units k, units u
      WHERE u.id = ${unitId} AND k.level = 'kelompok' AND k.path <@ u.path
      ORDER BY k.name`),
  );
}
