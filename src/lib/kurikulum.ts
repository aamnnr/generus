import "server-only";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { curriculumPeriods, jenjang, jenjangKategori, kitab, materi, periodTargets } from "@/db/schema";
import { withRls, type JwtClaims } from "@/db/rls";
import { ASPEK_ORDER, type Aspek, type AssessmentMode, type KitabUnit } from "@/lib/kurikulum-format";

export interface PeriodListItem {
  id: string;
  name: string;
  semester: string;
  startsOn: string;
  endsOn: string;
  publishedAt: Date | null;
  targetCount: number;
}

/** Periode terbaru dulu. Draf hanya terlihat oleh penyusun (RLS). */
export async function listPeriods(claims: JwtClaims): Promise<PeriodListItem[]> {
  return withRls(claims, (tx) =>
    tx
      .select({
        id: curriculumPeriods.id,
        name: curriculumPeriods.name,
        semester: curriculumPeriods.semester,
        startsOn: curriculumPeriods.startsOn,
        endsOn: curriculumPeriods.endsOn,
        publishedAt: curriculumPeriods.publishedAt,
        targetCount: sql<number>`(SELECT count(*)::int FROM period_targets pt WHERE pt.period_id = curriculum_periods.id)`,
      })
      .from(curriculumPeriods)
      .orderBy(desc(curriculumPeriods.startsOn)),
  );
}

export async function getPeriod(claims: JwtClaims, id: string): Promise<PeriodListItem | null> {
  const rows = await listPeriods(claims);
  return rows.find((p) => p.id === id) ?? null;
}

export interface TargetRow {
  id: string;
  jenjangId: string;
  kategoriId: string | null;
  kategoriName: string | null;
  gender: "L" | "P" | null;
  sortOrder: number;
  aspek: Aspek;
  mapel: string;
  note: string | null;
  strategy: string | null;
  optional: boolean;
  materi: {
    id: string;
    title: string;
    body: string | null;
    arabic: string | null;
    translation: string | null;
    source: string | null;
    assessment: AssessmentMode;
  } | null;
  kitab: { id: string; title: string; unit: KitabUnit; total: number; from: number; to: number } | null;
}

/** Target satu periode untuk satu jenjang, urut aspek → urutan. */
export async function listTargets(claims: JwtClaims, periodId: string, jenjangId: string): Promise<TargetRow[]> {
  const rows = await withRls(claims, (tx) =>
    tx
      .select({
        t: periodTargets,
        kategoriName: jenjangKategori.name,
        m: materi,
        k: kitab,
      })
      .from(periodTargets)
      .leftJoin(jenjangKategori, eq(jenjangKategori.id, periodTargets.kategoriId))
      .leftJoin(materi, eq(materi.id, periodTargets.materiId))
      .leftJoin(kitab, eq(kitab.id, periodTargets.kitabId))
      .where(and(eq(periodTargets.periodId, periodId), eq(periodTargets.jenjangId, jenjangId)))
      .orderBy(asc(periodTargets.sortOrder), asc(periodTargets.createdAt)),
  );
  return rows
    .map(({ t, kategoriName, m, k }) => ({
      id: t.id,
      jenjangId: t.jenjangId,
      kategoriId: t.kategoriId,
      kategoriName,
      gender: t.gender,
      sortOrder: t.sortOrder,
      aspek: t.aspek,
      mapel: t.mapel,
      note: t.note,
      strategy: t.strategy,
      optional: t.optional,
      materi: m
        ? { id: m.id, title: m.title, body: m.body, arabic: m.arabic, translation: m.translation, source: m.source, assessment: m.assessment }
        : null,
      kitab: k && t.rangeFrom != null && t.rangeTo != null
        ? { id: k.id, title: k.title, unit: k.unit, total: k.total, from: t.rangeFrom, to: t.rangeTo }
        : null,
    }))
    .sort((a, b) => ASPEK_ORDER.indexOf(a.aspek) - ASPEK_ORDER.indexOf(b.aspek) || a.sortOrder - b.sortOrder);
}

export interface MapelGroup {
  aspek: Aspek;
  mapel: string;
  strategy: string | null;
  targets: TargetRow[];
}

/** Kelompokkan target berurutan menjadi blok aspek → mapel seperti tabel dokumen PPG. */
export function groupTargets(rows: TargetRow[]): { aspek: Aspek; mapel: MapelGroup[] }[] {
  const out: { aspek: Aspek; mapel: MapelGroup[] }[] = [];
  for (const t of rows) {
    let a = out.find((x) => x.aspek === t.aspek);
    if (!a) out.push((a = { aspek: t.aspek, mapel: [] }));
    let m = a.mapel.find((x) => x.mapel === t.mapel);
    if (!m) a.mapel.push((m = { aspek: t.aspek, mapel: t.mapel, strategy: null, targets: [] }));
    m.targets.push(t);
    m.strategy ??= t.strategy;
  }
  return out;
}

export interface MateriItem {
  id: string;
  aspek: Aspek;
  mapel: string;
  title: string;
  body: string | null;
  arabic: string | null;
  translation: string | null;
  source: string | null;
  assessment: AssessmentMode;
  archived: boolean;
  usedIn: number;
}

export async function listMateri(
  claims: JwtClaims,
  opts: { q?: string; aspek?: Aspek; archived?: boolean } = {},
): Promise<MateriItem[]> {
  const where = [eq(materi.archived, opts.archived ?? false)];
  if (opts.aspek) where.push(eq(materi.aspek, opts.aspek));
  if (opts.q) where.push(or(ilike(materi.title, `%${opts.q}%`), ilike(materi.mapel, `%${opts.q}%`))!);
  const rows = await withRls(claims, (tx) =>
    tx
      .select({
        id: materi.id,
        aspek: materi.aspek,
        mapel: materi.mapel,
        title: materi.title,
        body: materi.body,
        arabic: materi.arabic,
        translation: materi.translation,
        source: materi.source,
        assessment: materi.assessment,
        archived: materi.archived,
        usedIn: sql<number>`(SELECT count(*)::int FROM period_targets pt WHERE pt.materi_id = materi.id)`,
      })
      .from(materi)
      .where(and(...where))
      .orderBy(asc(materi.mapel), asc(materi.title)),
  );
  return rows.sort((a, b) => ASPEK_ORDER.indexOf(a.aspek) - ASPEK_ORDER.indexOf(b.aspek));
}

export interface KitabItem {
  id: string;
  title: string;
  unit: KitabUnit;
  total: number;
  sortOrder: number;
  archived: boolean;
  usedIn: number;
}

export async function listKitab(claims: JwtClaims, opts: { includeArchived?: boolean } = {}): Promise<KitabItem[]> {
  return withRls(claims, (tx) =>
    tx
      .select({
        id: kitab.id,
        title: kitab.title,
        unit: kitab.unit,
        total: kitab.total,
        sortOrder: kitab.sortOrder,
        archived: kitab.archived,
        usedIn: sql<number>`(SELECT count(*)::int FROM period_targets pt WHERE pt.kitab_id = kitab.id)`,
      })
      .from(kitab)
      .where(opts.includeArchived ? undefined : eq(kitab.archived, false))
      .orderBy(asc(kitab.sortOrder), asc(kitab.title)),
  );
}

/** Jenjang beserta kategorinya (untuk tab & pilihan sasaran target). */
export async function listJenjangWithKategori(claims: JwtClaims) {
  const rows = await withRls(claims, (tx) =>
    tx
      .select({ id: jenjang.id, name: jenjang.name, kId: jenjangKategori.id, kName: jenjangKategori.name })
      .from(jenjang)
      .leftJoin(jenjangKategori, eq(jenjangKategori.jenjangId, jenjang.id))
      .orderBy(asc(jenjang.sortOrder), asc(jenjangKategori.sortOrder)),
  );
  const out: { id: string; name: string; kategori: { id: string; name: string }[] }[] = [];
  for (const r of rows) {
    let j = out.find((x) => x.id === r.id);
    if (!j) out.push((j = { id: r.id, name: r.name, kategori: [] }));
    if (r.kId && r.kName) j.kategori.push({ id: r.kId, name: r.kName });
  }
  return out;
}

/** Nama mapel yang pernah dipakai per aspek (pustaka & target), untuk saran isian. */
export async function listMapelNames(claims: JwtClaims): Promise<Record<Aspek, string[]>> {
  const rows = await withRls(claims, async (tx) => [
    ...(await tx.selectDistinct({ aspek: materi.aspek, mapel: materi.mapel }).from(materi)),
    ...(await tx.selectDistinct({ aspek: periodTargets.aspek, mapel: periodTargets.mapel }).from(periodTargets)),
  ]);
  const out: Record<Aspek, string[]> = { alim: [], faqih: [], akhlaq: [], mandiri: [] };
  for (const r of rows) if (!out[r.aspek].includes(r.mapel)) out[r.aspek].push(r.mapel);
  for (const a of ASPEK_ORDER) out[a].sort((x, y) => x.localeCompare(y, "id"));
  return out;
}
