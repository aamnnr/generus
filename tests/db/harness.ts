import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { ltree } from "@electric-sql/pglite/contrib/ltree";

const DRIZZLE_DIR = path.resolve(__dirname, "../../drizzle");

/**
 * Tiruan minimal bagian Supabase yang dipakai migrasi: schema `auth`,
 * `auth.uid()` (dibaca dari setting `request.jwt.claim.sub` seperti di
 * Supabase), serta role `authenticated` / `anon`.
 */
const SUPABASE_STUB = `
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb
  );
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
  GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
`;

export function migrationFiles(): string[] {
  const journal = JSON.parse(readFileSync(path.join(DRIZZLE_DIR, "meta/_journal.json"), "utf8")) as {
    entries: { tag: string }[];
  };
  return journal.entries.map((e) => path.join(DRIZZLE_DIR, `${e.tag}.sql`));
}

export async function createTestDb(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { ltree } });
  await db.exec(SUPABASE_STUB);
  await db.exec("SET search_path = public, extensions;");
  for (const file of migrationFiles()) {
    await db.exec(readFileSync(file, "utf8"));
  }
  await db.exec("GRANT USAGE ON SCHEMA extensions TO authenticated;");
  return db;
}

/** Jalankan `fn` sebagai user `userId` dengan RLS aktif, lalu kembali ke superuser. */
export async function asUser<T>(db: PGlite, userId: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${userId}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false);`);
  }
}

export async function createUser(db: PGlite, name: string): Promise<string> {
  const res = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('name', $2::text)) RETURNING id`,
    [`${name.toLowerCase().replace(/\s+/g, ".")}@generus.test`, name],
  );
  return res.rows[0].id;
}

export async function createUnit(
  db: PGlite,
  level: "daerah" | "desa" | "kelompok",
  name: string,
  parentId: string | null,
): Promise<string> {
  const res = await db.query<{ id: string }>(
    `INSERT INTO units (level, name, parent_id) VALUES ($1, $2, $3) RETURNING id`,
    [level, name, parentId],
  );
  return res.rows[0].id;
}

export async function grantRole(db: PGlite, userId: string, unitId: string, role: string) {
  await db.query(`INSERT INTO user_roles (user_id, unit_id, role) VALUES ($1, $2, $3)`, [userId, unitId, role]);
}
