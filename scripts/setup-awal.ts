/**
 * Menyiapkan server baru yang masih kosong (mis. VPS klien): satu unit daerah
 * dan satu akun superadmin sistem. Desa, kelompok, akun pengurus, dan generus
 * selanjutnya diisi dari aplikasi (menu Wilayah, Akun & peran, Import Excel).
 *
 *   node scripts/with-env.mjs .env.production.local tsx scripts/setup-awal.ts --daerah "Klaten Timur 1"
 *
 * Butuh DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, dan
 * SETUP_ADMIN_EMAIL / SETUP_ADMIN_NAME / SETUP_ADMIN_PASSWORD. Menolak berjalan
 * bila database sudah berisi wilayah.
 */
import "dotenv/config";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const env = process.env;
  const need = ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SETUP_ADMIN_EMAIL", "SETUP_ADMIN_NAME", "SETUP_ADMIN_PASSWORD"];
  const missing = need.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Belum diisi: ${missing.join(", ")}`);
  if ((env.SETUP_ADMIN_PASSWORD ?? "").length < 10) throw new Error("SETUP_ADMIN_PASSWORD minimal 10 karakter");
  const i = process.argv.indexOf("--daerah");
  const daerah = i > 0 ? process.argv[i + 1]?.trim() : "";
  if (!daerah || daerah.length < 2) throw new Error('Isi nama daerah: --daerah "Nama Daerah"');

  const sql = postgres(env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM units`;
    if (n > 0) throw new Error(`Database ini sudah berisi ${n} unit wilayah — setup dibatalkan agar data tidak tertimpa.`);

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

    await sql.begin(async (tx) => {
      const [unit] = await tx`INSERT INTO units (level, name) VALUES ('daerah', ${daerah}) RETURNING id`;
      await tx`INSERT INTO user_roles (user_id, unit_id, role) VALUES (${userId}, ${unit.id}, 'superadmin') ON CONFLICT DO NOTHING`;
      await tx`INSERT INTO system_admins (user_id) VALUES (${userId}) ON CONFLICT DO NOTHING`;
    });
    console.log(`✓ Daerah ${daerah} dan superadmin sistem ${env.SETUP_ADMIN_EMAIL} siap.`);
    console.log("Langkah berikutnya: jadwal penguncian presensi (db-cron), lalu login dan isi menu Wilayah.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
