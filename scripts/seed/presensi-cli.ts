/** Lihat scripts/seed/presensi.ts. */
import "dotenv/config";
import postgres from "postgres";
import type { Query } from "./insert";
import { insertPresensiSample } from "./presensi";

async function main() {
  const { DATABASE_URL, APP_ENV } = process.env;
  if (!DATABASE_URL) throw new Error("DATABASE_URL belum diisi (lihat .env.example)");
  if (APP_ENV === "production") throw new Error("Seed tidak boleh dijalankan di production");
  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    const res = await sql.begin(async (tx) => {
      const q: Query = async (text, params = []) => (await tx.unsafe(text, params as postgres.ParameterOrJSON<never>[])) as never;
      return insertPresensiSample(q, { reset: process.argv.includes("--reset") });
    });
    console.log(res.skipped ? "• Contoh presensi sudah ada; pakai --reset untuk mengisi ulang" : `✓ ${res.agendas} agenda contoh, ${res.attendance} presensi (terkunci)`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
