/**
 * Contoh riwayat presensi untuk dashboard & laporan (Fase 5): satu pengajian
 * rutin per kelompok tiap Ahad selama `WEEKS` pekan terakhir, presensi acak
 * (deterministik) lalu dikunci.
 *
 *   pnpm db:seed:presensi           # lewati bila contoh sudah ada
 *   pnpm db:seed:presensi --reset   # hapus contoh lama lalu isi ulang
 */
import type { Query } from "./insert";

export const SAMPLE_TITLE = "Pengajian rutin kelompok (contoh)";
const WEEKS = 8;

export async function insertPresensiSample(q: Query, opts: { reset?: boolean; today?: string } = {}) {
  const [{ n }] = await q<{ n: number }>(`SELECT count(*)::int AS n FROM agendas WHERE title = $1`, [SAMPLE_TITLE]);
  if (n > 0 && !opts.reset) return { skipped: true, agendas: 0, attendance: 0 };
  if (n > 0) await q(`DELETE FROM agendas WHERE title = $1`, [SAMPLE_TITLE]);

  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  // Ahad-Ahad sebelum hari ini, pukul 19.30 WIB.
  const agendas = await q<{ id: string }>(
    `WITH days AS (
       SELECT (date_trunc('week', $2::date)::date - 1 - 7 * i) AS d FROM generate_series(0, $3 - 1) i
     )
     INSERT INTO agendas (unit_id, title, starts_at, ends_at, late_after, delegate_until)
     SELECT k.id, $1,
       (days.d + time '19:30') AT TIME ZONE 'Asia/Jakarta',
       (days.d + time '21:00') AT TIME ZONE 'Asia/Jakarta',
       (days.d + time '19:45') AT TIME ZONE 'Asia/Jakarta',
       (days.d + time '21:00') AT TIME ZONE 'Asia/Jakarta' + interval '2 days'
     FROM units k CROSS JOIN days
     WHERE k.level = 'kelompok' AND days.d < $2::date
     RETURNING id`,
    [SAMPLE_TITLE, today, WEEKS],
  );

  // Status acak per (agenda, generus) yang stabil: hash dari kedua id.
  // Sekitar 1 dari 40 generus "sering absen" agar peringatan alpa 3× muncul.
  const [{ rows }] = await q<{ rows: number }>(
    `WITH ins AS (
       INSERT INTO attendance (agenda_id, generus_id, status, method)
       SELECT a.id, g.id,
         CASE
           WHEN abs(hashtext(g.id::text)) % 40 = 0 AND a.starts_at > now() - interval '22 days' THEN 'alpa'
           ELSE (ARRAY['hadir','hadir','hadir','hadir','hadir','hadir','hadir','hadir','hadir','hadir','hadir','hadir','hadir','hadir',
                       'terlambat','terlambat','izin','sakit','alpa','alpa'])[1 + abs(hashtext(a.id::text || g.id::text)) % 20]
         END::attendance_status,
         'manual'
       FROM agendas a JOIN generus g ON g.kelompok_id = a.unit_id AND app.agenda_is_target(a, g)
       WHERE a.title = $1
       RETURNING 1
     ) SELECT count(*)::int AS rows FROM ins`,
    [SAMPLE_TITLE],
  );
  await q(`UPDATE agendas SET locked_at = delegate_until WHERE title = $1 AND locked_at IS NULL`, [SAMPLE_TITLE]);
  return { skipped: false, agendas: agendas.length, attendance: rows };
}
