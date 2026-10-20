"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { generus, jenjang, jenjangKategori } from "@/db/schema";
import { withRls } from "@/db/rls";
import { requireGenerusWriter } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-error";
import { MAX_PROMOTION_ROWS } from "@/lib/generus";
import { TRANSITIONS, type TransitionKey } from "@/lib/kenaikan-rules";

export interface PromoteState {
  error?: string;
  ok?: string;
  /** Berubah tiap simpan, agar daftar centang dimuat ulang. */
  nonce?: string;
}

const schema = z.object({
  transition: z.enum(Object.keys(TRANSITIONS) as [TransitionKey]),
  ids: z.array(z.string().uuid()).min(1, "Centang minimal satu generus").max(MAX_PROMOTION_ROWS),
});

export async function promoteGenerus(_prev: PromoteState, formData: FormData): Promise<PromoteState> {
  const me = await requireGenerusWriter();
  const parsed = schema.safeParse({ transition: formData.get("transition"), ids: formData.getAll("ids") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const t = TRANSITIONS[parsed.data.transition];

  try {
    const updated = await withRls(me.claims, async (tx) => {
      const ref = async (j: string, k: string | null) => {
        const [row] = await tx
          .select({ jenjangId: jenjang.id, kategoriId: jenjangKategori.id })
          .from(jenjang)
          .leftJoin(jenjangKategori, and(eq(jenjangKategori.jenjangId, jenjang.id), eq(jenjangKategori.name, k ?? "")))
          .where(eq(jenjang.name, j));
        if (!row || (k && !row.kategoriId)) throw new Error(`Jenjang ${j} ${k ?? ""} tidak ditemukan`);
        return { jenjangId: row.jenjangId, kategoriId: k ? row.kategoriId : null };
      };
      const from = await ref(t.from.jenjang, t.from.kategori);
      const to = await ref(t.to.jenjang, t.to.kategori);

      // Hanya generus yang masih di jenjang asal & aktif yang diubah, supaya
      // pengiriman ganda atau data yang sudah berubah tidak ikut "naik" lagi.
      return tx
        .update(generus)
        .set({ jenjangId: to.jenjangId, kategoriId: to.kategoriId })
        .where(
          and(
            inArray(generus.id, parsed.data.ids),
            eq(generus.status, "aktif"),
            eq(generus.jenjangId, from.jenjangId),
            from.kategoriId ? eq(generus.kategoriId, from.kategoriId) : isNull(generus.kategoriId),
          ),
        )
        .returning({ id: generus.id });
    });
    revalidatePath("/generus");
    revalidatePath("/generus/kenaikan");
    const skipped = parsed.data.ids.length - updated.length;
    return {
      ok: `${updated.length} generus dinaikkan ke ${t.to.jenjang} ${t.to.kategori}.${skipped ? ` ${skipped} dilewati (sudah berubah atau di luar akses Anda).` : ""}`,
      nonce: crypto.randomUUID(),
    };
  } catch (err) {
    return { error: dbErrorMessage(err) };
  }
}
