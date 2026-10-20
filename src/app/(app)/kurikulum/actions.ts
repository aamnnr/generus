"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { curriculumPeriods, kitab, materi, periodTargets } from "@/db/schema";
import { withRls, type RlsTx } from "@/db/rls";
import { requireCurriculumEditor } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-error";
import { ASPEK_ORDER, parsePosition } from "@/lib/kurikulum-format";

export interface KurikulumFormState {
  error?: string;
  ok?: string;
  values?: Record<string, string>;
}

function formValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = { _n: crypto.randomUUID() };
  for (const [k, v] of fd) if (typeof v === "string") out[k] = v;
  return out;
}

const fail = (fd: FormData, error: string): KurikulumFormState => ({ error, values: formValues(fd) });
const opt = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || null);
const uuidOrNull = z
  .string()
  .optional()
  .transform((v) => v || null)
  .pipe(z.string().uuid().nullable());
const aspekSchema = z.enum(["alim", "faqih", "akhlaq", "mandiri"], { message: "Pilih aspek" });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid");

function revalidateKurikulum() {
  revalidatePath("/kurikulum", "layout");
}

// ---------------------------------------------------------------------------
// Periode
// ---------------------------------------------------------------------------

const periodSchema = z
  .object({
    id: uuidOrNull,
    name: z.string().trim().min(3, "Nama periode minimal 3 huruf").max(60),
    semester: z.string().trim().min(1, "Isi semester, mis. 1 - 2026").max(30),
    startsOn: date,
    endsOn: date,
    copyFrom: uuidOrNull,
  })
  .refine((v) => v.endsOn >= v.startsOn, { message: "Tanggal selesai harus setelah tanggal mulai", path: ["endsOn"] });

export async function savePeriod(_prev: KurikulumFormState, fd: FormData): Promise<KurikulumFormState> {
  const me = await requireCurriculumEditor();
  const parsed = periodSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(fd, parsed.error.issues[0].message);
  const { id, copyFrom, ...v } = parsed.data;

  let newId: string;
  try {
    newId = await withRls(me.claims, async (tx) => {
      if (id) {
        await tx.update(curriculumPeriods).set(v).where(eq(curriculumPeriods.id, id));
        return id;
      }
      const [row] = await tx.insert(curriculumPeriods).values({ ...v, createdBy: me.id }).returning({ id: curriculumPeriods.id });
      if (copyFrom) {
        await tx.execute(sql`
          INSERT INTO period_targets (period_id, jenjang_id, kategori_id, gender, sort_order, aspek, mapel,
            materi_id, kitab_id, range_from, range_to, note, strategy, optional)
          SELECT ${row.id}, jenjang_id, kategori_id, gender, sort_order, aspek, mapel,
            materi_id, kitab_id, range_from, range_to, note, strategy, optional
          FROM period_targets WHERE period_id = ${copyFrom}`);
      }
      return row.id;
    });
  } catch (err) {
    return fail(fd, dbErrorMessage(err));
  }
  revalidateKurikulum();
  if (id) return { ok: "Periode disimpan." };
  redirect(`/kurikulum/periode/${newId}`);
}

export async function setPublished(fd: FormData): Promise<void> {
  const me = await requireCurriculumEditor();
  const id = z.string().uuid().parse(fd.get("id"));
  const publish = fd.get("publish") === "1";
  await withRls(me.claims, (tx) =>
    tx
      .update(curriculumPeriods)
      .set({ publishedAt: publish ? new Date() : null })
      .where(eq(curriculumPeriods.id, id)),
  );
  revalidateKurikulum();
}

export async function deletePeriod(_prev: KurikulumFormState, fd: FormData): Promise<KurikulumFormState> {
  const me = await requireCurriculumEditor();
  const id = z.string().uuid().parse(fd.get("id"));
  try {
    await withRls(me.claims, (tx) => tx.delete(curriculumPeriods).where(eq(curriculumPeriods.id, id)));
  } catch (err) {
    const msg = dbErrorMessage(err);
    return { error: msg.startsWith("Data masih dipakai") ? "Tidak bisa dihapus: sudah ada capaian yang diisi untuk periode ini." : msg };
  }
  revalidateKurikulum();
  redirect("/kurikulum");
}

// ---------------------------------------------------------------------------
// Target
// ---------------------------------------------------------------------------

const targetSchema = z.object({
  id: uuidOrNull,
  periodId: z.string().uuid(),
  jenjangId: z.string().uuid(),
  kind: z.enum(["materi", "baru", "kitab"]),
  aspek: aspekSchema,
  mapel: z.string().trim().min(2, "Isi mata pelajaran").max(80),
  materiId: uuidOrNull,
  title: opt,
  body: opt,
  arabic: opt,
  translation: opt,
  source: opt,
  assessment: z.enum(["generus", "kelompok"]).default("generus"),
  kitabId: uuidOrNull,
  from: opt,
  to: opt,
  note: opt,
  strategy: opt,
  kategoriId: uuidOrNull,
  gender: z
    .enum(["", "L", "P"])
    .default("")
    .transform((v) => (v === "" ? null : v)),
  optional: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

async function nextSort(tx: RlsTx, periodId: string, jenjangId: string): Promise<number> {
  const [{ n }] = await tx
    .select({ n: sql<number>`coalesce(max(${periodTargets.sortOrder}) + 1, 0)::int` })
    .from(periodTargets)
    .where(and(eq(periodTargets.periodId, periodId), eq(periodTargets.jenjangId, jenjangId)));
  return n;
}

export async function saveTarget(_prev: KurikulumFormState, fd: FormData): Promise<KurikulumFormState> {
  const me = await requireCurriculumEditor();
  const parsed = targetSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(fd, parsed.error.issues[0].message);
  const v = parsed.data;

  try {
    await withRls(me.claims, async (tx) => {
      let materiId: string | null = null;
      let kitabId: string | null = null;
      let rangeFrom: number | null = null;
      let rangeTo: number | null = null;

      if (v.kind === "materi") {
        if (!v.materiId) throw new UserError("Pilih materi dari pustaka");
        materiId = v.materiId;
      } else if (v.kind === "baru") {
        if (!v.title || v.title.length < 2) throw new UserError("Isi judul materi baru");
        const [m] = await tx
          .insert(materi)
          .values({
            aspek: v.aspek,
            mapel: v.mapel,
            title: v.title,
            body: v.body,
            arabic: v.arabic,
            translation: v.translation,
            source: v.source,
            assessment: v.assessment,
          })
          .returning({ id: materi.id });
        materiId = m.id;
      } else {
        if (!v.kitabId) throw new UserError("Pilih kitab");
        const [k] = await tx.select().from(kitab).where(eq(kitab.id, v.kitabId));
        if (!k) throw new UserError("Kitab tidak ditemukan");
        const hint = k.unit === "ayat" ? "mis. Al-Baqarah 253 atau 2:253" : `angka 1–${k.total}`;
        rangeFrom = parsePosition(k.unit, v.from ?? "", k.total);
        rangeTo = parsePosition(k.unit, v.to ?? "", k.total);
        if (rangeFrom === null) throw new UserError(`Posisi awal tidak dikenali (${hint})`);
        if (rangeTo === null) throw new UserError(`Posisi akhir tidak dikenali (${hint})`);
        if (rangeTo < rangeFrom) throw new UserError("Posisi akhir harus setelah posisi awal");
        kitabId = k.id;
      }

      const row = {
        periodId: v.periodId,
        jenjangId: v.jenjangId,
        kategoriId: v.kategoriId,
        gender: v.gender,
        aspek: v.aspek,
        mapel: v.mapel,
        materiId,
        kitabId,
        rangeFrom,
        rangeTo,
        note: v.note,
        strategy: v.strategy,
        optional: v.optional,
      };
      if (v.id) {
        await tx.update(periodTargets).set(row).where(eq(periodTargets.id, v.id));
      } else {
        await tx.insert(periodTargets).values({ ...row, sortOrder: await nextSort(tx, v.periodId, v.jenjangId) });
      }
    });
  } catch (err) {
    return fail(fd, err instanceof UserError ? err.message : dbErrorMessage(err));
  }
  revalidateKurikulum();
  return { ok: v.id ? "Target disimpan." : "Target ditambahkan.", values: v.id ? undefined : keepForNext(fd) };
}

/** Setelah menambah, pertahankan aspek/mapel/strategi agar input berikutnya cepat. */
function keepForNext(fd: FormData): Record<string, string> {
  const keep = ["kind", "aspek", "mapel", "strategy", "assessment", "kategoriId", "gender", "kitabId"];
  const out: Record<string, string> = { _n: crypto.randomUUID() };
  for (const k of keep) {
    const val = fd.get(k);
    if (typeof val === "string") out[k] = val;
  }
  return out;
}

class UserError extends Error {}

export async function deleteTarget(fd: FormData): Promise<{ error?: string }> {
  const me = await requireCurriculumEditor();
  const id = z.string().uuid().parse(fd.get("id"));
  try {
    await withRls(me.claims, (tx) => tx.delete(periodTargets).where(eq(periodTargets.id, id)));
  } catch (err) {
    const msg = dbErrorMessage(err);
    return { error: msg.startsWith("Data masih dipakai") ? "Tidak bisa dihapus: sudah ada capaian untuk target ini." : msg };
  }
  revalidateKurikulum();
  return {};
}

/** Geser target naik/turun di dalam aspeknya. */
export async function moveTarget(fd: FormData): Promise<void> {
  const me = await requireCurriculumEditor();
  const id = z.string().uuid().parse(fd.get("id"));
  const dir = fd.get("dir") === "up" ? -1 : 1;
  await withRls(me.claims, async (tx) => {
    const [t] = await tx.select().from(periodTargets).where(eq(periodTargets.id, id));
    if (!t) return;
    const rows = (
      await tx
        .select({ id: periodTargets.id, aspek: periodTargets.aspek, sortOrder: periodTargets.sortOrder, createdAt: periodTargets.createdAt })
        .from(periodTargets)
        .where(and(eq(periodTargets.periodId, t.periodId), eq(periodTargets.jenjangId, t.jenjangId)))
    ).sort(
      (a, b) =>
        ASPEK_ORDER.indexOf(a.aspek) - ASPEK_ORDER.indexOf(b.aspek) ||
        a.sortOrder - b.sortOrder ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const i = rows.findIndex((r) => r.id === id);
    const j = i + dir;
    if (j < 0 || j >= rows.length || rows[j].aspek !== rows[i].aspek) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    for (const [n, r] of rows.entries()) {
      if (r.sortOrder !== n) await tx.update(periodTargets).set({ sortOrder: n }).where(eq(periodTargets.id, r.id));
    }
  });
  revalidateKurikulum();
}

// ---------------------------------------------------------------------------
// Pustaka materi & kitab
// ---------------------------------------------------------------------------

const materiSchema = z.object({
  id: uuidOrNull,
  aspek: aspekSchema,
  mapel: z.string().trim().min(2, "Isi mata pelajaran").max(80),
  title: z.string().trim().min(2, "Isi judul materi").max(200),
  body: opt,
  arabic: opt,
  translation: opt,
  source: opt,
  assessment: z.enum(["generus", "kelompok"]),
});

export async function saveMateri(_prev: KurikulumFormState, fd: FormData): Promise<KurikulumFormState> {
  const me = await requireCurriculumEditor();
  const parsed = materiSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(fd, parsed.error.issues[0].message);
  const { id, ...v } = parsed.data;
  try {
    await withRls(me.claims, (tx) =>
      id ? tx.update(materi).set(v).where(eq(materi.id, id)) : tx.insert(materi).values(v),
    );
  } catch (err) {
    return fail(fd, dbErrorMessage(err));
  }
  revalidateKurikulum();
  if (id) return { ok: "Materi disimpan." };
  redirect("/kurikulum/materi");
}

export async function setMateriArchived(fd: FormData): Promise<void> {
  const me = await requireCurriculumEditor();
  const id = z.string().uuid().parse(fd.get("id"));
  await withRls(me.claims, (tx) => tx.update(materi).set({ archived: fd.get("archived") === "1" }).where(eq(materi.id, id)));
  revalidateKurikulum();
}

const kitabSchema = z.object({
  id: uuidOrNull,
  title: z.string().trim().min(2, "Isi nama kitab").max(120),
  unit: z.enum(["ayat", "halaman", "bab"]),
  total: z.coerce.number().int("Jumlah harus bilangan bulat").min(1, "Jumlah minimal 1").max(100_000),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export async function saveKitab(_prev: KurikulumFormState, fd: FormData): Promise<KurikulumFormState> {
  const me = await requireCurriculumEditor();
  const parsed = kitabSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(fd, parsed.error.issues[0].message);
  const { id, ...v } = parsed.data;
  try {
    await withRls(me.claims, async (tx) => {
      if (!id) return tx.insert(kitab).values(v);
      const [{ maxTo }] = await tx
        .select({ maxTo: sql<number>`coalesce(max(${periodTargets.rangeTo}), 0)::int` })
        .from(periodTargets)
        .where(eq(periodTargets.kitabId, id));
      if (v.total < maxTo) throw new UserError(`Jumlah tidak boleh kurang dari ${maxTo} (sudah dipakai di target)`);
      return tx.update(kitab).set(v).where(eq(kitab.id, id));
    });
  } catch (err) {
    return fail(fd, err instanceof UserError ? err.message : dbErrorMessage(err));
  }
  revalidateKurikulum();
  return { ok: id ? "Kitab disimpan." : "Kitab ditambahkan.", values: id ? undefined : { _n: crypto.randomUUID() } };
}

export async function setKitabArchived(fd: FormData): Promise<void> {
  const me = await requireCurriculumEditor();
  const id = z.string().uuid().parse(fd.get("id"));
  await withRls(me.claims, (tx) => tx.update(kitab).set({ archived: fd.get("archived") === "1" }).where(eq(kitab.id, id)));
  revalidateKurikulum();
}
