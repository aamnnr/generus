/**
 * Menjadikan sebuah akun superadmin sistem (boleh menambah daerah & mengelola
 * semua daerah). Status ini sengaja tidak bisa diberikan dari aplikasi.
 *
 *   pnpm resmi:system-admin <email>      # server resmi (.env.resmi)
 *   pnpm exec tsx scripts/system-admin.ts <email>   # server uji (.env)
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Pemakaian: system-admin <email>");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    const [user] = await sql`SELECT id FROM auth.users WHERE lower(email) = ${email}`;
    if (!user) throw new Error(`Akun ${email} tidak ditemukan`);
    await sql`INSERT INTO system_admins (user_id) VALUES (${user.id}) ON CONFLICT DO NOTHING`;
    const list = await sql`SELECT u.email FROM system_admins s JOIN auth.users u ON u.id = s.user_id ORDER BY 1`;
    console.log(`✓ ${email} kini superadmin sistem. Semua superadmin sistem: ${list.map((r) => r.email).join(", ")}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
