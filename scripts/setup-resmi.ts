/**
 * Menyiapkan server RESMI (Tahap 1: Database Generus & Presensi) yang masih kosong:
 * wilayah Daerah Klaten Timur 1 → Desa Samber → 13 kelompok, dan satu akun superadmin.
 *
 *   pnpm resmi:setup              # wilayah + superadmin
 *   pnpm resmi:setup --generus    # + 302 nama generus Samber (jenis kelamin/jenjang/
 *                                 #   tanggal lahir masih perkiraan, ditandai di catatan)
 *
 * Membaca .env.resmi (lewat scripts/with-env.mjs). Tidak membuat akun uji maupun
 * data contoh presensi/kurikulum. Menolak berjalan bila wilayah sudah ada.
 */
import "dotenv/config";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import type { Query } from "./seed/insert";
import { insertSeed } from "./seed/insert";
import { generateSamberData } from "./seed/samber-data";

async function main() {
  const env = process.env;
  const need = ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SETUP_ADMIN_EMAIL", "SETUP_ADMIN_NAME", "SETUP_ADMIN_PASSWORD"];
  const missing = need.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Belum diisi di .env.resmi: ${missing.join(", ")}`);
  if ((env.SETUP_ADMIN_PASSWORD ?? "").length < 10) throw new Error("SETUP_ADMIN_PASSWORD minimal 10 karakter");

  const withGenerus = process.argv.includes("--generus");
  const sql = postgres(env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM units`;
    if (n > 0) throw new Error(`Database ini sudah berisi ${n} unit wilayah — setup dibatalkan agar data tidak tertimpa.`);

    const data = generateSamberData();
    if (!withGenerus) for (const k of data.desa[0].kelompok) k.generus = [];

    const result = await sql.begin(async (tx) => {
      const q: Query = async (text, params = []) => (await tx.unsafe(text, params as postgres.ParameterOrJSON<never>[])) as never;
      return insertSeed(q, data);
    });
    console.log(`✓ ${data.daerah} → Desa ${data.desa[0].name}: ${result.counts.kelompok} kelompok, ${result.counts.generus} generus`);

    // Akun superadmin (dipakai ulang bila email sudah terdaftar).
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw listError;
    let userId = list.users.find((u) => u.email?.toLowerCase() === env.SETUP_ADMIN_EMAIL!.toLowerCase())?.id;
    if (!userId) {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: env.SETUP_ADMIN_EMAIL!,
        password: env.SETUP_ADMIN_PASSWORD!,
        email_confirm: true,
        user_metadata: { name: env.SETUP_ADMIN_NAME },
      });
      if (error) throw error;
      userId = created.user.id;
    }
    await sql`INSERT INTO user_roles (user_id, unit_id, role) VALUES (${userId}, ${result.unitIds.daerah}, 'superadmin') ON CONFLICT DO NOTHING`;
    console.log(`✓ Superadmin ${env.SETUP_ADMIN_EMAIL}`);
    console.log("Langkah berikutnya: pnpm resmi:cron, lalu buat akun pengurus dari menu Akun & peran.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
