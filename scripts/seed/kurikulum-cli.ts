/** Lihat scripts/seed/kurikulum.ts. */
import "dotenv/config";
import postgres from "postgres";
import type { Query } from "./insert";
import { insertKurikulum } from "./kurikulum";
import { KURIKULUM_OKTOBER_2026 } from "./kurikulum-data";

async function main() {
  const { DATABASE_URL, APP_ENV } = process.env;
  if (!DATABASE_URL) throw new Error("DATABASE_URL belum diisi (lihat .env.example)");
  if (APP_ENV === "production") throw new Error("Seed tidak boleh dijalankan di production");

  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    const res = await sql.begin(async (tx) => {
      const q: Query = async (text, params = []) =>
        (await tx.unsafe(text, params as postgres.ParameterOrJSON<never>[])) as never;
      return insertKurikulum(q, KURIKULUM_OKTOBER_2026, { reset: process.argv.includes("--reset") });
    });
    console.log(
      res.skipped
        ? `• Periode ${KURIKULUM_OKTOBER_2026.name} sudah ada; pakai --reset untuk mengisi ulang`
        : `✓ Periode ${KURIKULUM_OKTOBER_2026.name}: ${res.targets} target (terbit)`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
