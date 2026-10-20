"use server";

import { revalidatePath } from "next/cache";
import { generus } from "@/db/schema";
import { withRls } from "@/db/rls";
import { requireGenerusWriter, type CurrentUser } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-error";
import { listJenjang, listScopeUnits } from "@/lib/generus";
import {
  duplicateKey,
  readGenerusSheet,
  validateRows,
  type ImportContext,
  type ImportRow,
} from "@/lib/import/generus-import";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const INSERT_BATCH = 500;

export interface ImportState {
  step: "upload" | "preview" | "done";
  error?: string;
  fileName?: string;
  counts?: { ok: number; error: number; duplikat: number };
  /** Baris bermasalah (semua) + contoh baris OK, untuk ditampilkan. */
  problems?: ImportRow[];
  sample?: ImportRow[];
  imported?: number;
}

async function loadContext(me: CurrentUser): Promise<ImportContext> {
  const [kelompok, jenjang, existing] = await Promise.all([
    listScopeUnits(me.claims, "write"),
    listJenjang(me.claims),
    withRls(me.claims, (tx) =>
      tx.select({ kelompokId: generus.kelompokId, name: generus.name, birthDate: generus.birthDate }).from(generus),
    ),
  ]);
  return {
    kelompok: kelompok.map((k) => ({ id: k.id, name: k.name, desaName: k.desaName })),
    jenjang,
    existingKeys: new Set(existing.map((g) => duplicateKey(g.kelompokId, g.name, g.birthDate))),
  };
}

async function parseUpload(me: CurrentUser, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih file Excel (.xlsx) terlebih dahulu." };
  if (file.size > MAX_FILE_BYTES) return { error: "Ukuran file maksimal 5 MB." };
  if (!/\.(xlsx|xls)$/i.test(file.name)) return { error: "Format file harus .xlsx (Excel)." };

  let sheet: unknown[][] | null;
  try {
    sheet = readGenerusSheet(new Uint8Array(await file.arrayBuffer()));
  } catch {
    return { error: "File tidak bisa dibaca. Pastikan file Excel (.xlsx) tidak rusak." };
  }
  if (!sheet) return { error: "Sheet \"Generus\" tidak ditemukan. Gunakan template resmi." };

  const result = validateRows(sheet, await loadContext(me));
  if (result.fileError) return { error: result.fileError };
  return { fileName: file.name, rows: result.rows };
}

/** Data insert tidak perlu dikirim ke browser untuk pratinjau. */
const withoutData = (r: ImportRow): ImportRow => ({ ...r, data: undefined });

function summarize(rows: ImportRow[]) {
  const counts = { ok: 0, error: 0, duplikat: 0 };
  for (const r of rows) counts[r.status]++;
  return counts;
}

/** Langkah 1: baca & periksa file, belum menyimpan apa pun. */
export async function previewImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const me = await requireGenerusWriter();
  const parsed = await parseUpload(me, formData);
  if ("error" in parsed) return { step: "upload", error: parsed.error };
  if (parsed.rows.length === 0) return { step: "upload", error: "Tidak ada baris data di sheet Generus (baris contoh dilewati)." };

  return {
    step: "preview",
    fileName: parsed.fileName,
    counts: summarize(parsed.rows),
    problems: parsed.rows.filter((r) => r.status !== "ok").map(withoutData),
    sample: parsed.rows.filter((r) => r.status === "ok").slice(0, 10).map(withoutData),
  };
}

/** Langkah 2: periksa ulang file yang sama lalu simpan semua baris yang valid. */
export async function commitImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const me = await requireGenerusWriter();
  const parsed = await parseUpload(me, formData);
  if ("error" in parsed) return { step: "upload", error: parsed.error };
  const valid = parsed.rows.flatMap((r) => (r.status === "ok" && r.data ? [r.data] : []));
  if (valid.length === 0) return { step: "upload", error: "Tidak ada baris valid untuk disimpan." };

  try {
    // Satu transaksi: semua tersimpan atau tidak sama sekali. RLS tetap
    // memastikan setiap baris berada di lingkup user.
    await withRls(me.claims, async (tx) => {
      for (let i = 0; i < valid.length; i += INSERT_BATCH) {
        await tx.insert(generus).values(valid.slice(i, i + INSERT_BATCH));
      }
    });
  } catch (err) {
    return { step: "upload", error: `Import dibatalkan, tidak ada data yang tersimpan. ${dbErrorMessage(err)}` };
  }
  revalidatePath("/generus");
  return { step: "done", fileName: parsed.fileName, imported: valid.length, counts: summarize(parsed.rows) };
}
