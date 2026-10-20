import type { SeedData } from "./generate";

/** Eksekutor SQL berparameter; diadaptasi dari postgres-js maupun PGlite. */
export type Query = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

export interface InsertResult {
  unitIds: { daerah: string; firstDesa: string; firstKelompok: string };
  counts: { desa: number; kelompok: number; generus: number };
}

const GENERUS_COLUMNS = [
  "kelompok_id", "name", "gender", "birth_date", "jenjang_id",
  "kategori_id", "school", "guardian_name", "guardian_phone",
] as const;
const BATCH = 500;

/**
 * Menulis data contoh ke database. Harus dijalankan dengan koneksi yang
 * melewati RLS (role postgres / service), bukan sebagai user aplikasi.
 */
export async function insertSeed(q: Query, data: SeedData): Promise<InsertResult> {
  const jenjang = await q<{ id: string; name: string }>(`SELECT id, name FROM jenjang`);
  const kategori = await q<{ id: string; name: string }>(`SELECT id, name FROM jenjang_kategori`);
  const jenjangId = (name: string) => {
    const row = jenjang.find((r) => r.name === name);
    if (!row) throw new Error(`Jenjang "${name}" belum ada; jalankan migrasi terlebih dahulu`);
    return row.id;
  };
  const kategoriId = (name: string | null) => (name ? kategori.find((r) => r.name === name)!.id : null);

  const [daerah] = await q<{ id: string }>(
    `INSERT INTO units (level, name) VALUES ('daerah', $1) RETURNING id`,
    [data.daerah],
  );

  const rows: unknown[][] = [];
  let firstDesa = "";
  let firstKelompok = "";
  let kelompokCount = 0;

  for (const desa of data.desa) {
    const [d] = await q<{ id: string }>(
      `INSERT INTO units (level, name, parent_id) VALUES ('desa', $1, $2) RETURNING id`,
      [desa.name, daerah.id],
    );
    firstDesa ||= d.id;
    for (const kel of desa.kelompok) {
      const [k] = await q<{ id: string }>(
        `INSERT INTO units (level, name, parent_id) VALUES ('kelompok', $1, $2) RETURNING id`,
        [kel.name, d.id],
      );
      firstKelompok ||= k.id;
      kelompokCount++;
      for (const g of kel.generus) {
        rows.push([
          k.id, g.name, g.gender, g.birthDate, jenjangId(g.jenjang),
          kategoriId(g.kategori), g.school, g.guardianName, g.guardianPhone,
        ]);
      }
    }
  }

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const width = GENERUS_COLUMNS.length;
    const values = chunk
      .map((_, r) => `(${GENERUS_COLUMNS.map((_, c) => `$${r * width + c + 1}`).join(", ")})`)
      .join(", ");
    await q(`INSERT INTO generus (${GENERUS_COLUMNS.join(", ")}) VALUES ${values}`, chunk.flat());
  }

  return {
    unitIds: { daerah: daerah.id, firstDesa, firstKelompok },
    counts: { desa: data.desa.length, kelompok: kelompokCount, generus: rows.length },
  };
}
