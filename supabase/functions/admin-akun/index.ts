// Edge Function admin-akun: operasi Supabase Auth admin untuk aplikasi Android
// (generus-mobile), padanan src/app/(app)/admin/akun/actions.ts di PWA.
//
// Aplikasi tidak boleh memegang service role key, jadi pembuatan akun, reset
// password, dan blokir login dilakukan di sini. Pemanggil harus superadmin
// (dicek lewat RPC public.mobile_is_superadmin dengan token pemanggil); perubahan
// tabel profiles/user_roles memakai token pemanggil sehingga RLS tetap berlaku.
//
// Deploy: supabase functions deploy admin-akun --project-ref <ref>
// Variabel SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY disediakan otomatis.

import { createClient } from "jsr:@supabase/supabase-js@2";

// Tanpa huruf/angka yang mirip (0/O, 1/l/I) agar mudah dibacakan lewat WhatsApp.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROLES = ["superadmin", "kurikulum", "admin", "kyai"];

function tempPassword(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Kesalahan pengguna dikembalikan sebagai 200 + {ok:false, error} agar aplikasi menampilkan pesannya.
const reply = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { headers: { ...cors, "Content-Type": "application/json" } });
const fail = (error: string) => reply({ ok: false, error });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("Metode tidak didukung.");

  const url = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData } = await asUser.auth.getUser();
  const me = userData?.user;
  if (!me) return fail("Sesi tidak valid. Masuk ulang lalu coba lagi.");
  const { data: isSuperadmin } = await asUser.rpc("mobile_is_superadmin");
  if (isSuperadmin !== true) return fail("Hanya superadmin yang boleh mengelola akun.");

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Isian tidak valid.");
  }
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");

  switch (body.action) {
    case "create": {
      const name = str("name");
      const email = str("email").toLowerCase();
      const phone = str("phone") || null;
      const role = str("role");
      const unitId = str("unit_id");
      if (name.length < 2) return fail("Nama minimal 2 huruf");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Email tidak valid");
      if (!ROLES.includes(role)) return fail("Pilih peran");
      if (!UUID.test(unitId)) return fail("Pilih unit");

      const password = tempPassword();
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (error) {
        if (error.code === "email_exists") return fail("Email sudah dipakai akun lain.");
        return fail("Gagal membuat akun di Supabase Auth.");
      }
      const userId = data.user.id;
      // Profil dibuat trigger handle_new_user; lengkapi lewat RLS superadmin.
      const upd = await asUser.from("profiles").update({ name, phone, must_change_password: true }).eq("id", userId);
      const ins = upd.error ? upd : await asUser.from("user_roles").insert({ user_id: userId, unit_id: unitId, role });
      if (ins.error) {
        // Batalkan akun auth agar tidak ada akun tanpa peran yang valid.
        await admin.auth.admin.deleteUser(userId);
        return fail(ins.error.code === "P0001" ? ins.error.message : "Gagal menyimpan peran akun.");
      }
      return reply({ ok: true, user_id: userId, temp_password: password });
    }

    case "reset_password": {
      const userId = str("user_id");
      if (!UUID.test(userId)) return fail("Akun tidak valid.");
      if (userId === me.id) return fail("Untuk akun sendiri, gunakan menu Ganti password.");
      const password = tempPassword();
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return fail("Gagal mereset password.");
      await asUser.from("profiles").update({ must_change_password: true }).eq("id", userId);
      return reply({ ok: true, temp_password: password });
    }

    case "set_active": {
      const userId = str("user_id");
      const active = body.active === true;
      if (!UUID.test(userId)) return fail("Akun tidak valid.");
      if (userId === me.id) return fail("Anda tidak bisa menonaktifkan akun sendiri.");
      const upd = await asUser.from("profiles").update({ active }).eq("id", userId);
      if (upd.error) return fail("Gagal mengubah status akun.");
      // Blokir juga di Auth agar tidak bisa login sama sekali selama nonaktif.
      await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
      return reply({ ok: true });
    }

    default:
      return fail("Tindakan tidak dikenal.");
  }
});
