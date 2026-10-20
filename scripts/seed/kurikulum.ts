/**
 * Mengisi contoh kurikulum (periode Oktober 2026 dari dokumen Tim Kurikulum PPG).
 *
 *   pnpm db:seed:kurikulum           # lewati bila periode sudah ada
 *   pnpm db:seed:kurikulum --reset   # hapus periode itu (beserta capaiannya) lalu isi ulang
 *
 * Butuh DATABASE_URL. Pustaka materi & kitab di-upsert, jadi aman diulang.
 */
import type { Query } from "./insert";
import type { SeedPeriod } from "./kurikulum-data";

export interface KurikulumResult {
  periodId: string;
  targets: number;
  skipped: boolean;
}

/** Harus dijalankan dengan koneksi yang melewati RLS. */
export async function insertKurikulum(q: Query, data: SeedPeriod, opts: { reset?: boolean } = {}): Promise<KurikulumResult> {
  const [existing] = await q<{ id: string }>(`SELECT id FROM curriculum_periods WHERE name = $1`, [data.name]);
  if (existing && !opts.reset) return { periodId: existing.id, targets: 0, skipped: true };
  if (existing) {
    const targets = `SELECT id FROM period_targets WHERE period_id = $1`;
    await q(`DELETE FROM achievements WHERE target_id IN (${targets})`, [existing.id]);
    await q(`DELETE FROM target_deliveries WHERE target_id IN (${targets})`, [existing.id]);
    await q(`DELETE FROM curriculum_periods WHERE id = $1`, [existing.id]);
  }

  const [jenjang] = await q<{ id: string }>(`SELECT id FROM jenjang WHERE name = $1`, [data.jenjang]);
  if (!jenjang) throw new Error(`Jenjang "${data.jenjang}" belum ada; jalankan migrasi terlebih dahulu`);

  for (const k of data.kitab) {
    await q(
      `INSERT INTO kitab (title, unit, total, sort_order) VALUES ($1, $2, $3, $4)
       ON CONFLICT (title) DO UPDATE SET unit = EXCLUDED.unit, total = EXCLUDED.total, sort_order = EXCLUDED.sort_order`,
      [k.title, k.unit, k.total, k.sortOrder],
    );
  }
  const kitab = new Map((await q<{ id: string; title: string }>(`SELECT id, title FROM kitab`)).map((k) => [k.title, k.id]));

  const [period] = await q<{ id: string }>(
    `INSERT INTO curriculum_periods (name, semester, starts_on, ends_on, published_at)
     VALUES ($1, $2, $3, $4, now()) RETURNING id`,
    [data.name, data.semester, data.startsOn, data.endsOn],
  );

  let sort = 0;
  for (const t of data.targets) {
    let materiId: string | null = null;
    if (t.materi) {
      const m = t.materi;
      [{ id: materiId }] = await q<{ id: string }>(
        `INSERT INTO materi (aspek, mapel, title, body, arabic, translation, source, assessment)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (aspek, mapel, title) DO UPDATE SET body = EXCLUDED.body, arabic = EXCLUDED.arabic,
           translation = EXCLUDED.translation, source = EXCLUDED.source, assessment = EXCLUDED.assessment
         RETURNING id`,
        [t.aspek, t.mapel, m.title, m.body ?? null, m.arabic ?? null, m.translation ?? null, m.source ?? null, m.assessment ?? "generus"],
      );
    }
    const kitabId = t.kitab ? kitab.get(t.kitab.title) : null;
    if (t.kitab && !kitabId) throw new Error(`Kitab "${t.kitab.title}" belum ada`);
    await q(
      `INSERT INTO period_targets (period_id, jenjang_id, gender, sort_order, aspek, mapel, materi_id, kitab_id,
         range_from, range_to, note, strategy, optional)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        period.id, jenjang.id, t.gender ?? null, sort++, t.aspek, t.mapel, materiId, kitabId ?? null,
        t.kitab?.from ?? null, t.kitab?.to ?? null, t.kitab?.note ?? null, t.strategy ?? null, t.optional ?? false,
      ],
    );
  }
  return { periodId: period.id, targets: sort, skipped: false };
}
