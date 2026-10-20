import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./index";

export type RlsTx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

export interface JwtClaims {
  sub: string;
  role?: string;
  [key: string]: unknown;
}

/**
 * Jalankan query atas nama user: role `authenticated` + klaim JWT di-set
 * lokal dalam satu transaksi, persis seperti PostgREST di Supabase, sehingga
 * semua kebijakan RLS berlaku. `claims` HARUS berasal dari JWT yang sudah
 * diverifikasi (lihat `getSession()` di src/lib/auth.ts).
 */
export function withRls<T>(claims: JwtClaims, fn: (tx: RlsTx) => Promise<T>): Promise<T> {
  return db().transaction(async (tx) => {
    await tx.execute(sql`
      SELECT set_config('request.jwt.claims', ${JSON.stringify(claims)}, true),
             set_config('request.jwt.claim.sub', ${claims.sub}, true)`);
    await tx.execute(sql`SET LOCAL ROLE authenticated`);
    return fn(tx);
  });
}
