import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Koneksi ini memakai role database dari DATABASE_URL dan TIDAK terkena RLS.
// Query atas nama user (yang harus dibatasi lingkupnya) wajib dijalankan
// dengan role `authenticated` + klaim JWT user — dibangun di Fase 1.

let client: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function db() {
  // Pooler Supabase memutus koneksi yang lama menganggur; tutup duluan agar
  // tidak memakai soket yang sudah mati (CONNECTION_CLOSED).
  client ??= drizzle(postgres(env().DATABASE_URL, { prepare: false, idle_timeout: 20, max_lifetime: 60 * 30 }), { schema });
  return client;
}

export { schema };
