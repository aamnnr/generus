import "server-only";
import { and, asc, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  generus,
  generusMutations,
  generusStatusHistory,
  jenjang,
  jenjangKategori,
  units,
} from "@/db/schema";
import { withRls, type JwtClaims } from "@/db/rls";

// Query data generus. Semua lewat RLS, jadi hasilnya otomatis sebatas
// lingkup user yang memanggil.

export type GenerusStatus = "aktif" | "pindah_sambung" | "menikah";

export const STATUS_LABEL: Record<GenerusStatus, string> = {
  aktif: "Aktif",
  pindah_sambung: "Pindah Sambung",
  menikah: "Menikah",
};

/** Filter jenjang gabungan jenjang + kategori, dipakai di URL. */
export const JENJANG_FILTERS = {
  "pra-remaja": { label: "Pra Remaja", jenjang: "Pra Remaja", kategori: null },
  remaja: { label: "Remaja (semua)", jenjang: "Remaja", kategori: null },
  "remaja-pelajar": { label: "Remaja Pelajar", jenjang: "Remaja", kategori: "Pelajar" },
  "remaja-mandiri": { label: "Remaja Mandiri", jenjang: "Remaja", kategori: "Mandiri" },
} as const;
export type JenjangFilter = keyof typeof JENJANG_FILTERS;

export interface GenerusFilters {
  q?: string;
  unitId?: string;
  jenjang?: JenjangFilter;
  status?: GenerusStatus | "semua";
  page?: number;
}

export const PAGE_SIZE = 50;

const desaUnit = alias(units, "desa");

export interface GenerusListItem {
  id: string;
  name: string;
  gender: "L" | "P";
  birthDate: string;
  jenjang: string;
  kategori: string | null;
  kelompok: string;
  desa: string;
  status: GenerusStatus;
}

export async function listGenerus(
  claims: JwtClaims,
  f: GenerusFilters,
): Promise<{ rows: GenerusListItem[]; total: number }> {
  return withRls(claims, async (tx) => {
    const where: SQL[] = [];
    if (f.status !== "semua") where.push(eq(generus.status, f.status ?? "aktif"));
    if (f.q?.trim()) where.push(ilike(generus.name, `%${f.q.trim()}%`));
    if (f.unitId) where.push(sql`${generus.unitPath} <@ (SELECT path FROM units WHERE id = ${f.unitId})`);
    if (f.jenjang) {
      const j = JENJANG_FILTERS[f.jenjang];
      where.push(eq(jenjang.name, j.jenjang));
      if (j.kategori) where.push(eq(jenjangKategori.name, j.kategori));
    }
    const cond = where.length ? and(...where) : undefined;

    const base = tx
      .select({
        id: generus.id,
        name: generus.name,
        gender: generus.gender,
        birthDate: generus.birthDate,
        jenjang: jenjang.name,
        kategori: jenjangKategori.name,
        kelompok: units.name,
        desa: desaUnit.name,
        status: generus.status,
      })
      .from(generus)
      .innerJoin(jenjang, eq(jenjang.id, generus.jenjangId))
      .leftJoin(jenjangKategori, eq(jenjangKategori.id, generus.kategoriId))
      .innerJoin(units, eq(units.id, generus.kelompokId))
      .innerJoin(desaUnit, eq(desaUnit.id, units.parentId))
      .where(cond);

    const page = Math.max(1, f.page ?? 1);
    const [rows, [{ total }]] = await Promise.all([
      base.orderBy(asc(generus.name)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
      tx
        .select({ total: sql<number>`count(*)::int` })
        .from(generus)
        .innerJoin(jenjang, eq(jenjang.id, generus.jenjangId))
        .leftJoin(jenjangKategori, eq(jenjangKategori.id, generus.kategoriId))
        .where(cond),
    ]);
    return { rows, total };
  });
}

export interface UnitOption {
  id: string;
  name: string;
  level: "desa" | "kelompok";
  desaName: string;
}

/**
 * Kelompok (dan desa) dalam lingkup tertentu:
 * - "read": untuk filter daftar (admin/kyai/superadmin)
 * - "write": kelompok tujuan saat menambah generus (admin/superadmin)
 * - "mutate": kelompok tujuan mutasi (admin desa/daerah & superadmin)
 */
export async function listScopeUnits(claims: JwtClaims, scope: "read" | "write" | "mutate"): Promise<UnitOption[]> {
  const scopeCond = {
    read: sql`u.path <@ (SELECT app.scope_paths(ARRAY['superadmin','admin','kyai']::app_role[]))`,
    write: sql`u.path <@ (SELECT app.scope_paths(ARRAY['superadmin','admin']::app_role[]))`,
    mutate: sql`EXISTS (
      SELECT 1 FROM user_roles ur JOIN units s ON s.id = ur.unit_id
      WHERE ur.user_id = auth.uid()
        AND (ur.role = 'superadmin' OR (ur.role = 'admin' AND s.level <> 'kelompok'))
        AND u.path <@ s.path)`,
  }[scope];
  const levels = scope === "read" ? sql`('desa','kelompok')` : sql`('kelompok')`;
  return withRls(claims, async (tx) => {
    const res = await tx.execute<{ id: string; name: string; level: "desa" | "kelompok"; desa_name: string }>(sql`
      SELECT u.id, u.name, u.level, CASE WHEN u.level = 'desa' THEN u.name ELSE p.name END AS desa_name
      FROM units u LEFT JOIN units p ON p.id = u.parent_id
      WHERE u.level IN ${levels} AND ${scopeCond}
      ORDER BY desa_name, u.level, u.name`);
    return res.map((r) => ({ id: r.id, name: r.name, level: r.level, desaName: r.desa_name }));
  });
}

export interface JenjangOption {
  id: string;
  name: string;
  kategori: { id: string; name: string }[];
}

export async function listJenjang(claims: JwtClaims): Promise<JenjangOption[]> {
  return withRls(claims, async (tx) => {
    const rows = await tx
      .select({ id: jenjang.id, name: jenjang.name, kId: jenjangKategori.id, kName: jenjangKategori.name })
      .from(jenjang)
      .leftJoin(jenjangKategori, eq(jenjangKategori.jenjangId, jenjang.id))
      .orderBy(asc(jenjang.sortOrder), asc(jenjangKategori.sortOrder));
    const out: JenjangOption[] = [];
    for (const r of rows) {
      let j = out.find((x) => x.id === r.id);
      if (!j) out.push((j = { id: r.id, name: r.name, kategori: [] }));
      if (r.kId && r.kName) j.kategori.push({ id: r.kId, name: r.kName });
    }
    return out;
  });
}

export interface GenerusDetail {
  id: string;
  name: string;
  gender: "L" | "P";
  birthDate: string;
  jenjangId: string;
  jenjang: string;
  kategoriId: string | null;
  kategori: string | null;
  kelompokId: string;
  kelompok: string;
  desa: string;
  school: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  notes: string | null;
  status: GenerusStatus;
  statusDate: string | null;
  statusNote: string | null;
  qrActive: boolean;
  history: { at: Date; text: string }[];
}

export async function getGenerus(claims: JwtClaims, id: string): Promise<GenerusDetail | null> {
  return withRls(claims, async (tx) => {
    const [g] = await tx
      .select({
        id: generus.id,
        name: generus.name,
        gender: generus.gender,
        birthDate: generus.birthDate,
        jenjangId: generus.jenjangId,
        jenjang: jenjang.name,
        kategoriId: generus.kategoriId,
        kategori: jenjangKategori.name,
        kelompokId: generus.kelompokId,
        kelompok: units.name,
        desa: desaUnit.name,
        school: generus.school,
        guardianName: generus.guardianName,
        guardianPhone: generus.guardianPhone,
        notes: generus.notes,
        status: generus.status,
        statusDate: generus.statusDate,
        statusNote: generus.statusNote,
        qrActive: generus.qrActive,
      })
      .from(generus)
      .innerJoin(jenjang, eq(jenjang.id, generus.jenjangId))
      .leftJoin(jenjangKategori, eq(jenjangKategori.id, generus.kategoriId))
      .innerJoin(units, eq(units.id, generus.kelompokId))
      .innerJoin(desaUnit, eq(desaUnit.id, units.parentId))
      .where(eq(generus.id, id));
    if (!g) return null;

    const fromUnit = alias(units, "from_unit");
    const toUnit = alias(units, "to_unit");
    const [mutations, statuses] = await Promise.all([
      tx
        .select({ at: generusMutations.mutatedAt, from: fromUnit.name, to: toUnit.name })
        .from(generusMutations)
        .innerJoin(fromUnit, eq(fromUnit.id, generusMutations.fromUnitId))
        .innerJoin(toUnit, eq(toUnit.id, generusMutations.toUnitId))
        .where(eq(generusMutations.generusId, id)),
      tx
        .select({
          at: generusStatusHistory.changedAt,
          to: generusStatusHistory.toStatus,
          date: generusStatusHistory.statusDate,
          note: generusStatusHistory.note,
        })
        .from(generusStatusHistory)
        .where(eq(generusStatusHistory.generusId, id))
        .orderBy(desc(generusStatusHistory.changedAt)),
    ]);
    const history = [
      ...mutations.map((m) => ({ at: m.at, text: `Pindah kelompok: ${m.from} → ${m.to}` })),
      ...statuses.map((s) => ({
        at: s.at,
        text: `Status: ${STATUS_LABEL[s.to]} (${formatDate(s.date)})${s.note ? ` — ${s.note}` : ""}`,
      })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime());

    return { ...g, history };
  });
}

export const MAX_PROMOTION_ROWS = 500;

export interface PromotionCandidate {
  id: string;
  name: string;
  gender: "L" | "P";
  birthDate: string;
  school: string | null;
  kelompok: string;
}

/** Generus aktif dengan jenjang/kategori asal tertentu di dalam unit (desa/kelompok). */
export async function listPromotionCandidates(
  claims: JwtClaims,
  from: { jenjang: string; kategori: string | null },
  unitId: string,
): Promise<{ rows: PromotionCandidate[]; truncated: boolean }> {
  return withRls(claims, async (tx) => {
    const rows = await tx
      .select({
        id: generus.id,
        name: generus.name,
        gender: generus.gender,
        birthDate: generus.birthDate,
        school: generus.school,
        kelompok: units.name,
      })
      .from(generus)
      .innerJoin(jenjang, eq(jenjang.id, generus.jenjangId))
      .leftJoin(jenjangKategori, eq(jenjangKategori.id, generus.kategoriId))
      .innerJoin(units, eq(units.id, generus.kelompokId))
      .where(
        and(
          eq(generus.status, "aktif"),
          eq(jenjang.name, from.jenjang),
          from.kategori ? eq(jenjangKategori.name, from.kategori) : sql`${generus.kategoriId} IS NULL`,
          sql`${generus.unitPath} <@ (SELECT path FROM units WHERE id = ${unitId})`,
        ),
      )
      .orderBy(asc(units.name), asc(generus.birthDate), asc(generus.name))
      .limit(MAX_PROMOTION_ROWS + 1);
    return { rows: rows.slice(0, MAX_PROMOTION_ROWS), truncated: rows.length > MAX_PROMOTION_ROWS };
  });
}

/** Usia dalam tahun pada tanggal `on`. */
export function ageOn(birthDate: string, on = new Date()): number {
  const b = new Date(`${birthDate}T00:00:00`);
  let age = on.getFullYear() - b.getFullYear();
  const m = on.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) age--;
  return age;
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function jenjangLabel(j: string, k: string | null): string {
  return k ? `${j} ${k}` : j;
}
