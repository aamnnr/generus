import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { env, serviceRoleKey } from "@/lib/env";

/**
 * Klien Supabase dengan sesi dari cookie. Buat baru per request.
 *
 * Secara default klien ini HANYA MEMBACA cookie: refresh sesi dilakukan oleh
 * proxy.ts. Menulis cookie di tengah render/Server Action biasa membuat Next
 * gagal membaca cookie saat me-render ulang halaman (InvariantError). Hanya
 * aksi yang memang mengubah sesi (login, logout, ganti password) yang memakai
 * `{ writeCookies: true }`.
 */
export async function createSupabaseServer({ writeCookies = false } = {}) {
  const cookieStore = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = env();
  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        if (!writeCookies) return;
        for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
      },
    },
  });
}

/**
 * Klien service role untuk operasi admin Auth (buat akun, reset password).
 * Melewati RLS: panggil HANYA setelah memastikan pemanggil superadmin.
 */
export function createSupabaseAdmin() {
  return createClient(env().NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
