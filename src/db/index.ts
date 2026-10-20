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
  client ??= drizzle(postgres(env().DATABASE_URL, { prepare: false }), { schema });
  return client;
}

export { schema };
