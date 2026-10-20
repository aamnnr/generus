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
  if (!client) {
    const url = env().DATABASE_URL;
    // Di serverless (Vercel) tiap instance membuka pool sendiri. Session pooler
    // Supabase (5432) dibatasi ±15 klien untuk SEMUA instance → EMAXCONNSESSION.
    // Wajib Transaction pooler (6543); pool per instance dibuat kecil.
    if (process.env.VERCEL && /:5432\//.test(url)) {
      console.error("DATABASE_URL memakai Session pooler (5432). Di Vercel gunakan Transaction pooler (port 6543). Lihat docs/DEPLOY.md.");
    }
    client = drizzle(
      postgres(url, {
        prepare: false,
        max: Number(process.env.DB_POOL_MAX) || (process.env.VERCEL ? 3 : 5),
        // Pooler Supabase memutus koneksi yang lama menganggur; tutup duluan agar
        // tidak memakai soket yang sudah mati (CONNECTION_CLOSED).
        idle_timeout: 20,
        max_lifetime: 60 * 30,
      }),
      { schema },
    );
  }
  return client;
}

export { schema };
