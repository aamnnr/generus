/**
 * Menjadwalkan penguncian presensi otomatis di Supabase dengan pg_cron.
 *
 *   pnpm db:cron            # pasang/perbarui jadwal (tiap 15 menit)
 *   pnpm db:cron --remove   # hapus jadwal
 *
 * Tanpa jadwal ini aplikasi tetap mengunci agenda yang lewat batas setiap kali
 * halaman Agenda dibuka; jadwal memastikan alpa terisi walau tidak ada yang membuka.
 * Butuh ekstensi pg_cron (Supabase → Database → Extensions, atau dibuat di sini).
 */
import "dotenv/config";
import postgres from "postgres";

const JOB = "generus-lock-agendas";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum diisi (lihat .env.example)");
  const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    if (process.argv.includes("--remove")) {
      await sql`SELECT cron.unschedule(${JOB}) WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = ${JOB})`;
      console.log(`✓ Jadwal ${JOB} dihapus`);
      return;
    }
    await sql`CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog`;
    await sql`SELECT cron.schedule(${JOB}, '*/15 * * * *', 'SELECT app.lock_due_agendas()')`;
    const [job] = await sql`SELECT jobid, schedule, command FROM cron.job WHERE jobname = ${JOB}`;
    console.log(`✓ Jadwal ${JOB} aktif: ${job.schedule} → ${job.command}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
