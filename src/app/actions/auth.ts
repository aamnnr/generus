"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { profiles } from "@/db/schema";
import { withRls } from "@/db/rls";
import { getCurrentUser } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { createSupabaseServer } from "@/lib/supabase/server";

export interface FormState {
  error?: string;
  email?: string;
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const supabase = await createSupabaseServer({ writeCookies: true });
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "user_banned") return { error: "Akun Anda dinonaktifkan. Hubungi superadmin.", email };
    return { error: "Email atau password salah.", email };
  }
  redirect("/beranda");
}

export async function logout() {
  const supabase = await createSupabaseServer({ writeCookies: true });
  await supabase.auth.signOut();
  redirect("/login");
}

const passwordSchema = z
  .object({
    password: z.string().min(MIN_PASSWORD_LENGTH, `Password minimal ${MIN_PASSWORD_LENGTH} karakter`),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Konfirmasi password tidak sama", path: ["confirm"] });

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser({ allowPasswordChange: true });
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createSupabaseServer({ writeCookies: true });
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { error: "Password baru harus berbeda dari password lama." };
    if (error.code === "weak_password") return { error: "Password terlalu lemah. Gunakan kombinasi huruf dan angka." };
    return { error: "Gagal mengganti password. Coba lagi." };
  }

  await withRls(user.claims, (tx) =>
    tx.update(profiles).set({ mustChangePassword: false }).where(eq(profiles.id, user.id)),
  );
  redirect("/beranda?status=password-diganti");
}
