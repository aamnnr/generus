"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { generus } from "@/db/schema";
import { withRls } from "@/db/rls";
import { requireGenerusWriter } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-error";

// Setiap aksi memeriksa ulang sesi; lingkup kelompok, aturan jenjang/kategori,
// status, dan mutasi ditegakkan oleh RLS & trigger di database.

export interface GenerusFormState {
  error?: string;
  ok?: string;
  values?: Record<string, string>;
}

function formValues(formData: FormData): Record<string, string> {
  const values = Object.fromEntries([...formData].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  // Penanda unik per pengiriman: key agar <select> dipasang ulang dengan nilai terakhir.
  return { ...values, _n: crypto.randomUUID() };
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .optional()
    .transform((v) => v || null);

const today = () => new Date().toISOString().slice(0, 10);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Tanggal tidak valid");

const generusSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 huruf").max(120),
  gender: z.enum(["L", "P"], { message: "Pilih jenis kelamin" }),
  birthDate: isoDate
    .refine((v) => v >= "1980-01-01", "Tanggal lahir terlalu lama")
    .refine((v) => v <= today(), "Tanggal lahir tidak boleh di masa depan"),
  jenjangId: z.string().uuid("Pilih jenjang"),
  kategoriId: z
    .string()
    .optional()
    .transform((v) => v || null)
    .pipe(z.string().uuid().nullable()),
  school: optionalText(120),
  guardianName: optionalText(120),
  guardianPhone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/[\s-]/g, "") : null))
    .refine((v) => v === null || /^(\+62|0)8\d{7,12}$/.test(v), "No. HP tidak valid (contoh 081234567890)"),
  notes: optionalText(500),
});

export async function createGenerus(_prev: GenerusFormState, formData: FormData): Promise<GenerusFormState> {
  const me = await requireGenerusWriter();
  const values = formValues(formData);
  const parsed = generusSchema.extend({ kelompokId: z.string().uuid("Pilih kelompok") }).safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  let id: string;
  try {
    const [row] = await withRls(me.claims, (tx) =>
      tx.insert(generus).values(parsed.data).returning({ id: generus.id }),
    );
    id = row.id;
  } catch (err) {
    return { error: dbErrorMessage(err), values };
  }
  revalidatePath("/generus");
  redirect(`/generus/${id}?pesan=dibuat`);
}

export async function updateGenerus(_prev: GenerusFormState, formData: FormData): Promise<GenerusFormState> {
  const me = await requireGenerusWriter();
  const values = formValues(formData);
  const parsed = generusSchema.extend({ id: z.string().uuid() }).safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const { id, ...data } = parsed.data;
  try {
    const res = await withRls(me.claims, (tx) =>
      tx.update(generus).set(data).where(eq(generus.id, id)).returning({ id: generus.id }),
    );
    if (res.length === 0) return { error: "Anda tidak punya akses untuk mengubah generus ini.", values };
  } catch (err) {
    return { error: dbErrorMessage(err), values };
  }
  revalidatePath(`/generus/${id}`);
  return { ok: "Data disimpan.", values };
}

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["aktif", "pindah_sambung", "menikah"]),
  statusDate: isoDate.refine((v) => v <= today(), "Tanggal tidak boleh di masa depan"),
  statusNote: optionalText(300),
});

export async function changeStatus(_prev: GenerusFormState, formData: FormData): Promise<GenerusFormState> {
  const me = await requireGenerusWriter();
  const values = formValues(formData);
  const parsed = statusSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const { id, ...data } = parsed.data;
  try {
    const res = await withRls(me.claims, (tx) =>
      tx.update(generus).set(data).where(eq(generus.id, id)).returning({ id: generus.id }),
    );
    if (res.length === 0) return { error: "Anda tidak punya akses untuk mengubah generus ini." };
  } catch (err) {
    return { error: dbErrorMessage(err) };
  }
  revalidatePath(`/generus/${id}`);
  revalidatePath("/generus");
  return { ok: data.status === "aktif" ? "Generus diaktifkan kembali." : "Status disimpan." };
}

const mutateSchema = z.object({ id: z.string().uuid(), kelompokId: z.string().uuid("Pilih kelompok tujuan") });

export async function mutateGenerus(_prev: GenerusFormState, formData: FormData): Promise<GenerusFormState> {
  const me = await requireGenerusWriter();
  const parsed = mutateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, kelompokId } = parsed.data;
  try {
    // Trigger hanya mengizinkan admin desa/daerah yang lingkupnya mencakup asal & tujuan.
    const res = await withRls(me.claims, (tx) =>
      tx.update(generus).set({ kelompokId }).where(eq(generus.id, id)).returning({ id: generus.id }),
    );
    if (res.length === 0) return { error: "Anda tidak punya akses untuk memindah generus ini." };
  } catch (err) {
    return { error: dbErrorMessage(err) };
  }
  revalidatePath(`/generus/${id}`);
  revalidatePath("/generus");
  return { ok: "Generus dipindahkan." };
}

export async function deleteGenerus(_prev: GenerusFormState, formData: FormData): Promise<GenerusFormState> {
  const me = await requireGenerusWriter();
  const id = z.string().uuid().parse(formData.get("id"));
  try {
    const res = await withRls(me.claims, (tx) =>
      tx.delete(generus).where(eq(generus.id, id)).returning({ id: generus.id }),
    );
    if (res.length === 0) return { error: "Anda tidak punya akses untuk menghapus generus ini." };
  } catch (err) {
    return { error: dbErrorMessage(err) };
  }
  revalidatePath("/generus");
  redirect("/generus?pesan=dihapus");
}

/** Terbitkan kartu baru: token QR diganti sehingga kartu lama tidak berlaku. */
export async function reissueCard(_prev: GenerusFormState, formData: FormData): Promise<GenerusFormState> {
  const me = await requireGenerusWriter();
  const id = z.string().uuid().parse(formData.get("id"));
  try {
    const res = await withRls(me.claims, (tx) =>
      tx
        .update(generus)
        .set({ qrToken: sql`upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))` })
        .where(eq(generus.id, id))
        .returning({ id: generus.id }),
    );
    if (res.length === 0) return { error: "Anda tidak punya akses untuk generus ini." };
  } catch (err) {
    return { error: dbErrorMessage(err) };
  }
  revalidatePath(`/generus/${id}`);
  return { ok: "Kartu baru diterbitkan. Kartu lama tidak berlaku lagi; cetak kartu baru." };
}
