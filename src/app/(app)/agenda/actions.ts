"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { agendas, attendance } from "@/db/schema";
import { withRls } from "@/db/rls";
import { segmentsToTarget } from "@/lib/agenda-target";
import { getCurrentUser, requireGenerusWriter } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-error";
import { listJenjang } from "@/lib/generus";
import { zonedToUtc } from "@/lib/time";

export interface AgendaFormState {
  error?: string;
  ok?: string;
  values?: Record<string, string | string[]>;
}

const MAX_REPEAT_WEEKS = 26;
const HOUR = 3600_000;
const DAY = 24 * HOUR;

function formValues(fd: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = { _n: crypto.randomUUID() };
  for (const key of new Set(fd.keys())) {
    const all = fd.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = key === "segments" ? all : (all[0] ?? "");
  }
  return out;
}

const time = z.string().regex(/^\d{2}:\d{2}$/, "Jam tidak valid");

const agendaSchema = z
  .object({
    unitId: z.string().uuid("Pilih penyelenggara"),
    title: z.string().trim().min(3, "Judul minimal 3 huruf").max(120),
    location: z
      .string()
      .trim()
      .max(160)
      .optional()
      .transform((v) => v || null),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
    startTime: time,
    endTime: time,
    lateMinutes: z.coerce.number().int().min(0).max(240),
    delegateDays: z.coerce.number().int().min(0).max(14),
    gender: z.enum(["", "L", "P"]).transform((v) => (v === "" ? null : v)),
    segments: z.array(z.string()).default([]),
  })
  .refine((v) => v.endTime > v.startTime, { message: "Jam selesai harus setelah jam mulai", path: ["endTime"] });

/** Hitung kolom waktu & sasaran dari isian form. */
async function buildAgenda(me: Awaited<ReturnType<typeof getCurrentUser>>, v: z.infer<typeof agendaSchema>) {
  const startsAt = zonedToUtc(v.date, v.startTime);
  const endsAt = zonedToUtc(v.date, v.endTime);
  const target = segmentsToTarget(v.segments, await listJenjang(me.claims));
  return {
    unitId: v.unitId,
    title: v.title,
    location: v.location,
    startsAt,
    endsAt,
    lateAfter: new Date(Math.min(startsAt.getTime() + v.lateMinutes * 60_000, endsAt.getTime())),
    delegateUntil: new Date(endsAt.getTime() + v.delegateDays * DAY),
    targetJenjangIds: target.jenjangIds,
    targetKategoriIds: target.kategoriIds,
    targetGender: v.gender,
  };
}

const shift = <T extends { startsAt: Date; endsAt: Date; lateAfter: Date; delegateUntil: Date }>(a: T, ms: number): T => ({
  ...a,
  startsAt: new Date(a.startsAt.getTime() + ms),
  endsAt: new Date(a.endsAt.getTime() + ms),
  lateAfter: new Date(a.lateAfter.getTime() + ms),
  delegateUntil: new Date(a.delegateUntil.getTime() + ms),
});

export async function createAgenda(_prev: AgendaFormState, fd: FormData): Promise<AgendaFormState> {
  const me = await requireGenerusWriter();
  const values = formValues(fd);
  const parsed = agendaSchema
    .and(z.object({ repeatWeeks: z.coerce.number().int().min(1).max(MAX_REPEAT_WEEKS) }))
    .safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const base = await buildAgenda(me, parsed.data);
  const weeks = parsed.data.repeatWeeks;
  const recurrenceId = weeks > 1 ? crypto.randomUUID() : null;
  let firstId: string;
  try {
    const rows = await withRls(me.claims, (tx) =>
      tx
        .insert(agendas)
        .values(Array.from({ length: weeks }, (_, i) => ({ ...shift(base, i * 7 * DAY), recurrenceId })))
        .returning({ id: agendas.id }),
    );
    firstId = rows[0].id;
  } catch (err) {
    return { error: dbErrorMessage(err), values };
  }
  revalidatePath("/agenda");
  redirect(`/agenda/${firstId}?pesan=${weeks > 1 ? `dibuat-${weeks}` : "dibuat"}`);
}

export async function updateAgenda(_prev: AgendaFormState, fd: FormData): Promise<AgendaFormState> {
  const me = await requireGenerusWriter();
  const values = formValues(fd);
  const parsed = agendaSchema.and(z.object({ id: z.string().uuid() })).safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const data = await buildAgenda(me, parsed.data);
  try {
    const res = await withRls(me.claims, (tx) =>
      tx.update(agendas).set(data).where(eq(agendas.id, parsed.data.id)).returning({ id: agendas.id }),
    );
    if (res.length === 0) return { error: "Anda tidak punya akses untuk mengubah agenda ini.", values };
  } catch (err) {
    return { error: dbErrorMessage(err), values };
  }
  revalidatePath(`/agenda/${parsed.data.id}`);
  revalidatePath("/agenda");
  redirect(`/agenda/${parsed.data.id}?pesan=diubah`);
}

export async function cancelAgenda(_prev: AgendaFormState, fd: FormData): Promise<AgendaFormState> {
  const me = await requireGenerusWriter();
  const id = z.string().uuid().parse(fd.get("id"));
  const scope = fd.get("scope") === "series" ? "series" : "single";
  try {
    await withRls(me.claims, async (tx) => {
      const [a] = await tx.select().from(agendas).where(eq(agendas.id, id));
      if (!a) throw new Error("Agenda tidak ditemukan");
      const where =
        scope === "series" && a.recurrenceId
          ? and(eq(agendas.recurrenceId, a.recurrenceId), gte(agendas.startsAt, a.startsAt), isNull(agendas.lockedAt))
          : eq(agendas.id, id);
      await tx.update(agendas).set({ cancelledAt: new Date() }).where(and(where, isNull(agendas.cancelledAt)));
    });
  } catch (err) {
    return { error: dbErrorMessage(err) };
  }
  revalidatePath("/agenda");
  revalidatePath(`/agenda/${id}`);
  return { ok: scope === "series" ? "Agenda ini dan pekan-pekan berikutnya dibatalkan." : "Agenda dibatalkan." };
}

const attendanceSchema = z.object({
  agendaId: z.string().uuid(),
  entries: z
    .array(z.object({ generusId: z.string().uuid(), status: z.enum(["hadir", "terlambat", "izin", "sakit", "alpa"]) }))
    .min(1, "Belum ada perubahan untuk disimpan")
    .max(2000),
});

export interface SaveAttendanceResult {
  error?: string;
  saved?: number;
}

/** Simpan beberapa status presensi sekaligus (dipanggil dari checklist). */
export async function saveAttendance(input: z.input<typeof attendanceSchema>): Promise<SaveAttendanceResult> {
  const me = await getCurrentUser();
  const parsed = attendanceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { agendaId, entries } = parsed.data;
  try {
    await withRls(me.claims, async (tx) => {
      const [{ manage }] = await tx
        .select({ manage: sql<boolean>`(SELECT app.scope_paths(ARRAY['superadmin','admin']::app_role[])) @> ${agendas.unitPath}` })
        .from(agendas)
        .where(eq(agendas.id, agendaId));
      await tx
        .insert(attendance)
        .values(entries.map((e) => ({ agendaId, generusId: e.generusId, status: e.status, method: manage ? "manual" as const : "delegasi" as const })))
        .onConflictDoUpdate({
          target: [attendance.agendaId, attendance.generusId],
          set: { status: sql`excluded.status`, method: sql`excluded.method` },
        });
    });
  } catch (err) {
    return { error: dbErrorMessage(err, "Gagal menyimpan presensi. Sebagian peserta mungkin di luar akses Anda atau batas waktu sudah lewat.") };
  }
  revalidatePath(`/agenda/${agendaId}`);
  return { saved: entries.length };
}

export async function lockAgenda(_prev: AgendaFormState, fd: FormData): Promise<AgendaFormState> {
  const me = await requireGenerusWriter();
  const id = z.string().uuid().parse(fd.get("id"));
  try {
    await withRls(me.claims, (tx) => tx.execute(sql`SELECT app.lock_agenda(${id})`));
  } catch (err) {
    return { error: dbErrorMessage(err) };
  }
  revalidatePath(`/agenda/${id}`);
  return { ok: "Presensi dikunci. Peserta yang belum tercatat menjadi alpa." };
}
