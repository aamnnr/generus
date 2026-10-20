/**
 * Ringkasan kondisi database di DATABASE_URL: migrasi, RLS, data referensi, jumlah data.
 *   pnpm db:check
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum diisi (lihat .env.example)");
  const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {}, connect_timeout: 15 });
  try {
    const [m] = await sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
    console.log(`Migrasi diterapkan : ${m.n}`);

    const tables = await sql`
      SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1`;
    const noRls = tables.filter((t) => !t.relrowsecurity).map((t) => t.relname);
    console.log(`Tabel              : ${tables.length} (${noRls.length ? `RLS MATI: ${noRls.join(", ")}` : "semua RLS aktif"})`);

    const [p] = await sql`SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'public'`;
    console.log(`Kebijakan RLS      : ${p.n}`);

    const jenjang = await sql`
      SELECT j.name, coalesce(string_agg(k.name, '/' ORDER BY k.sort_order), '-') AS kategori
      FROM jenjang j LEFT JOIN jenjang_kategori k ON k.jenjang_id = j.id
      GROUP BY j.name, j.sort_order ORDER BY j.sort_order`;
    console.log(`Jenjang            : ${jenjang.map((j) => `${j.name} (${j.kategori})`).join(", ")}`);

    const [c] = await sql`
      SELECT (SELECT count(*) FROM units WHERE level = 'desa')::int AS desa,
             (SELECT count(*) FROM units WHERE level = 'kelompok')::int AS kelompok,
             (SELECT count(*) FROM generus)::int AS generus,
             (SELECT count(*) FROM profiles)::int AS akun,
             (SELECT count(*) FROM user_roles)::int AS peran`;
    console.log(`Data               : ${c.desa} desa, ${c.kelompok} kelompok, ${c.generus} generus, ${c.akun} akun, ${c.peran} peran`);

    // Simulasikan tiap akun lewat role `authenticated` + klaim JWT, persis seperti
    // request dari aplikasi, lalu hitung generus yang terlihat oleh RLS.
    const accounts = await sql`
      SELECT p.id, p.name, string_agg(ur.role::text || '@' || u.level, ', ') AS roles
      FROM profiles p JOIN user_roles ur ON ur.user_id = p.id JOIN units u ON u.id = ur.unit_id
      GROUP BY p.id, p.name ORDER BY p.name`;
    if (accounts.length) console.log("Generus terlihat per akun (RLS):");
    for (const a of accounts) {
      const visible = await sql.begin(async (tx) => {
        await tx`SELECT set_config('request.jwt.claim.sub', ${a.id}, true),
                        set_config('request.jwt.claims', ${JSON.stringify({ sub: a.id, role: "authenticated" })}, true)`;
        await tx`SET LOCAL ROLE authenticated`;
        const [r] = await tx`SELECT count(*)::int AS n FROM generus`;
        return r.n as number;
      });
      console.log(`  ${String(a.name).padEnd(16)} ${String(visible).padStart(5)}  (${a.roles})`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
