"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { achievements, kitab, kitabProgress, targetDeliveries } from "@/db/schema";
import { withRls } from "@/db/rls";
import { requireGenerusWriter } from "@/lib/auth";
import { todayIso } from "@/lib/capaian";
import { dbErrorMessage } from "@/lib/db-error";
import { formatPosition, parsePosition } from "@/lib/kurikulum-format";

export interface CapaianState {
  error?: string;
  ok?: string;
  /** Penanda unik tiap simpan sukses, agar form bisa direset. */
  savedAt?: number;
}

const uuid = z.string().uuid();
const statusSchema = z.enum(["belum", "proses", "tuntas"]);
const sqlExcluded = (col: string) => sql.raw(`excluded.${col}`);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid");

/**
 * Simpan status capaian banyak pasangan (target, generus) sekaligus.
 * Field form: `s:<targetId>:<generusId>` = belum|proses|tuntas. "Belum" menghapus baris.
 */
export async function saveAchievements(_prev: CapaianState, fd: FormData): Promise<CapaianState> {
  const me = await requireGenerusWriter();
  const set: { targetId: string; generusId: string; status: "proses" | "tuntas" }[] = [];
  const clear: { targetId: string; generusId: string }[] = [];
  for (const [key, value] of fd) {
    if (!key.startsWith("s:")) continue;
    const [, targetId, generusId] = key.split(":");
    const status = statusSchema.safeParse(value);
    if (!uuid.safeParse(targetId).success || !uuid.safeParse(generusId).success || !status.success) {
      return { error: "Isian tidak valid. Muat ulang halaman lalu coba lagi." };
    }
    if (status.data === "belum") clear.push({ targetId, generusId });
    else set.push({ targetId, generusId, status: status.data });
  }
  if (set.length + clear.length === 0) return { error: "Tidak ada perubahan untuk disimpan." };

  try {
    await withRls(me.claims, async (tx) => {
      if (set.length) {
        await tx
          .insert(achievements)
          .values(set)
          .onConflictDoUpdate({ target: [achievements.targetId, achievements.generusId], set: { status: sqlExcluded("status") } });
      }
      for (const c of clear) {
        await tx.delete(achievements).where(and(eq(achievements.targetId, c.targetId), eq(achievements.generusId, c.generusId)));
      }
    });
  } catch (err) {
    return { error: dbErrorMessage(err) };
  }
  revalidatePath("/capaian", "layout");
  return { ok: `${set.length + clear.length} capaian disimpan.`, savedAt: Date.now() };
}

/** Tandai/batalkan "sudah disampaikan" untuk target per kelompok. */
export async function setDelivery(_prev: CapaianState, fd: FormData): Promise<CapaianState> {
  const me = await requireGenerusWriter();
  const parsed = z
    .object({
      targetId: uuid,
      kelompokId: uuid,
      delivered: z.enum(["1", "0"]),
      deliveredOn: date.optional(),
      note: z.string().trim().max(200).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  try {
    await withRls(me.claims, async (tx) => {
      if (v.delivered === "0") {
        await tx.delete(targetDeliveries).where(and(eq(targetDeliveries.targetId, v.targetId), eq(targetDeliveries.kelompokId, v.kelompokId)));
        return;
      }
      const deliveredOn = v.deliveredOn ?? todayIso();
      if (deliveredOn > todayIso()) throw new Error("future");
      await tx
        .insert(targetDeliveries)
        .values({ targetId: v.targetId, kelompokId: v.kelompokId, deliveredOn, note: v.note || null })
        .onConflictDoUpdate({
          target: [targetDeliveries.targetId, targetDeliveries.kelompokId],
          set: { deliveredOn, note: v.note || null },
        });
    });
  } catch (err) {
    return { error: err instanceof Error && err.message === "future" ? "Tanggal tidak boleh di masa depan." : dbErrorMessage(err) };
  }
  revalidatePath("/capaian", "layout");
  return { ok: v.delivered === "1" ? "Ditandai sudah disampaikan." : "Tanda dibatalkan.", savedAt: Date.now() };
}

/** Catat posisi kitab yang sama untuk beberapa generus (yang mengaji bersama). */
export async function saveKitabProgress(_prev: CapaianState, fd: FormData): Promise<CapaianState> {
  const me = await requireGenerusWriter();
  const parsed = z
    .object({
      kitabId: uuid,
      generusIds: z.array(uuid).min(1, "Pilih minimal satu generus"),
      position: z.string().trim().min(1, "Isi posisi terakhir"),
      recordedOn: date,
    })
    .safeParse({ ...Object.fromEntries(fd), generusIds: fd.getAll("generusIds") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (v.recordedOn > todayIso()) return { error: "Tanggal tidak boleh di masa depan." };

  try {
    const label = await withRls(me.claims, async (tx) => {
      const [k] = await tx.select().from(kitab).where(eq(kitab.id, v.kitabId));
      if (!k) throw new UserError("Kitab tidak ditemukan");
      const position = parsePosition(k.unit, v.position, k.total);
      if (position === null) {
        throw new UserError(k.unit === "ayat" ? "Posisi tidak dikenali (mis. Al-Baqarah 253 atau 2:253)" : `Posisi harus angka 1–${k.total}`);
      }
      // Satu catatan per generus per tanggal: catatan ulang di hari yang sama menggantikan yang lama.
      await tx
        .delete(kitabProgress)
        .where(and(eq(kitabProgress.kitabId, k.id), eq(kitabProgress.recordedOn, v.recordedOn), inArray(kitabProgress.generusId, v.generusIds)));
      await tx.insert(kitabProgress).values(v.generusIds.map((generusId) => ({ generusId, kitabId: k.id, position, recordedOn: v.recordedOn })));
      return formatPosition(k.unit, position);
    });
    revalidatePath("/capaian", "layout");
    return { ok: `Posisi ${label} dicatat untuk ${v.generusIds.length} generus.`, savedAt: Date.now() };
  } catch (err) {
    return { error: err instanceof UserError ? err.message : dbErrorMessage(err) };
  }
}

class UserError extends Error {}
