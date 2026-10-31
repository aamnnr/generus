"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { units, userRoles } from "@/db/schema";
import { withRls } from "@/db/rls";
import { requireSuperadmin } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-error";

export interface WilayahFormState {
  error?: string;
  ok?: string;
}

const nameSchema = z.string().trim().min(2, "Nama minimal 2 huruf").max(80, "Nama terlalu panjang");

const addSchema = z.discriminatedUnion("level", [
  z.object({ level: z.literal("daerah"), name: nameSchema }),
  z.object({ level: z.enum(["desa", "kelompok"]), parentId: z.string().uuid(), name: nameSchema }),
]);

const LEVEL_LABEL = { daerah: "Daerah", desa: "Desa", kelompok: "Kelompok" } as const;

export async function addUnit(_prev: WilayahFormState, formData: FormData): Promise<WilayahFormState> {
  const me = await requireSuperadmin();
  const parsed = addSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  if (data.level === "daerah" && !me.isSystemAdmin) return { error: "Hanya superadmin sistem yang boleh menambah daerah." };
  try {
    // Trigger units_before_write memastikan desa di bawah daerah & kelompok di bawah desa;
    // RLS memastikan unit baru ada di dalam lingkup pemanggil.
    await withRls(me.claims, async (tx) => {
      const [created] = await tx
        .insert(units)
        .values(data.level === "daerah" ? { level: "daerah", name: data.name } : data)
        .returning({ id: units.id });
      // Daerah baru langsung tampil di menu & laporan superadmin sistem.
      if (data.level === "daerah") await tx.insert(userRoles).values({ userId: me.id, unitId: created.id, role: "superadmin" });
    });
  } catch (err) {
    return { error: dbErrorMessage(err) };
  }
  revalidatePath("/admin/wilayah");
  return { ok: `${LEVEL_LABEL[data.level]} ${data.name} ditambahkan.` };
}

const renameSchema = z.object({ id: z.string().uuid(), name: nameSchema });

export async function renameUnit(_prev: WilayahFormState, formData: FormData): Promise<WilayahFormState> {
  const me = await requireSuperadmin();
  const parsed = renameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await withRls(me.claims, (tx) =>
      tx.update(units).set({ name: parsed.data.name }).where(eq(units.id, parsed.data.id)),
    );
  } catch (err) {
    return { error: dbErrorMessage(err) };
  }
  revalidatePath("/admin/wilayah");
  return { ok: "Nama disimpan." };
}

export async function deleteUnit(_prev: WilayahFormState, formData: FormData): Promise<WilayahFormState> {
  const me = await requireSuperadmin();
  const id = z.string().uuid().parse(formData.get("id"));
  try {
    // Ditolak database (FK restrict) bila masih punya kelompok atau generus.
    await withRls(me.claims, (tx) => tx.delete(units).where(eq(units.id, id)));
  } catch (err) {
    return {
      error: dbErrorMessage(err).startsWith("Data masih dipakai")
        ? "Tidak bisa dihapus: masih ada kelompok, generus, atau riwayat di dalamnya."
        : dbErrorMessage(err),
    };
  }
  revalidatePath("/admin/wilayah");
  return { ok: "Dihapus." };
}
