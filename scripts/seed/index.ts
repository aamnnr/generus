/**
 * Mengisi database development dengan data contoh.
 *
 *   pnpm db:seed            # data uji Desa Samber, Klaten Timur 1 (gagal jika wilayah sudah ada)
 *   pnpm db:seed --reset    # hapus wilayah, generus, agenda, presensi, capaian lama lalu isi ulang
 *   pnpm db:seed --dummy    # data sintetis besar (10 desa × 6 kelompok) untuk uji beban
 *
 * Butuh DATABASE_URL. Akun uji dibuat jika NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, dan SEED_USER_PASSWORD diisi.
 */
import "dotenv/config";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { generateSeedData, TEST_ACCOUNTS } from "./generate";
import { generateSamberData } from "./samber-data";
import { insertSeed, type InsertResult, type Query } from "./insert";

async function main() {
  const reset = process.argv.includes("--reset");
  const { DATABASE_URL, APP_ENV } = process.env;
  if (!DATABASE_URL) throw new Error("DATABASE_URL belum diisi (lihat .env.example)");
  if (APP_ENV === "production") throw new Error("Seed tidak boleh dijalankan di production");

  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
  const q: Query = async (text, params = []) =>
    (await sql.unsafe(text, params as postgres.ParameterOrJSON<never>[])) as never;

  try {
    const [{ n }] = await q<{ n: number }>(`SELECT count(*)::int AS n FROM units`);
    if (n > 0 && !reset) {
      throw new Error(`Sudah ada ${n} unit wilayah. Pakai --reset untuk menghapus dan mengisi ulang.`);
    }

    const result = await sql.begin(async (tx) => {
      const txq: Query = async (text, params = []) =>
        (await tx.unsafe(text, params as postgres.ParameterOrJSON<never>[])) as never;
      if (n > 0) {
        await txq(`TRUNCATE generus, generus_mutations, generus_status_history, user_roles, units, audit_log CASCADE`);
      }
      return insertSeed(txq, process.argv.includes("--dummy") ? generateSeedData() : generateSamberData());
    });

    console.log(
      `✓ ${result.counts.desa} desa, ${result.counts.kelompok} kelompok, ${result.counts.generus} generus`,
    );
    await seedAccounts(q, result);
  } finally {
    await sql.end();
  }
}

async function seedAccounts(q: Query, result: InsertResult) {
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, SEED_USER_PASSWORD: password } =
    process.env;
  if (!url || !key || !password) {
    console.log("• Akun uji dilewati (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SEED_USER_PASSWORD kosong)");
    return;
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: existing, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;

  const unitFor = { daerah: result.unitIds.daerah, desa: result.unitIds.firstDesa, kelompok: result.unitIds.firstKelompok };
  for (const acc of TEST_ACCOUNTS) {
    let userId = existing.users.find((u) => u.email === acc.email)?.id;
    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: acc.email,
        password,
        email_confirm: true,
        user_metadata: { name: acc.name },
      });
      if (error) throw error;
      userId = data.user.id;
    }
    await q(
      `INSERT INTO user_roles (user_id, unit_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [userId, unitFor[acc.unit], acc.role],
    );
  }
  console.log(`✓ ${TEST_ACCOUNTS.length} akun uji (${TEST_ACCOUNTS.map((a) => a.email).join(", ")})`);
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
