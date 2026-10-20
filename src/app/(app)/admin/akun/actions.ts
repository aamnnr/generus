"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { profiles, userRoles } from "@/db/schema";
import { withRls } from "@/db/rls";
import { requireSuperadmin } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-error";
import { generateTempPassword } from "@/lib/password";
import { createSupabaseAdmin } from "@/lib/supabase/server";

// Semua aksi di sini hanya untuk superadmin; diperiksa ulang di setiap aksi
// (requireSuperadmin) dan sekali lagi oleh RLS di database.

export interface AccountFormState {
  error?: string;
  ok?: string;
  /** Password sementara; ditampilkan sekali agar bisa diteruskan ke pemilik akun. */
  tempPassword?: string;
  accountId?: string;
  email?: string;
  /** Isian terakhir, agar form tidak kosong lagi setelah error. */
  values?: Record<string, string>;
}

function formValues(formData: FormData): Record<string, string> {
  const values = Object.fromEntries([...formData].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  // Penanda unik per pengiriman: dipakai sebagai key agar <select> dipasang ulang.
  return { ...values, _n: crypto.randomUUID() };
}

const ROLES = ["superadmin", "kurikulum", "admin", "kyai"] as const;
const optionalText = z
  .string()
  .trim()
  .transform((v) => v || null);

const createSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 huruf"),
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  phone: optionalText,
  role: z.enum(ROLES, { message: "Pilih peran" }),
  unitId: z.string().uuid("Pilih unit"),
});

export async function createAccount(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const me = await requireSuperadmin();
  const values = formValues(formData);
  const parsed = createSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const { name, email, phone, role, unitId } = parsed.data;

  const admin = createSupabaseAdmin();
  const tempPassword = generateTempPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) {
    if (error.code === "email_exists") return { error: "Email sudah dipakai akun lain.", values };
    return { error: "Gagal membuat akun di Supabase Auth.", values };
  }

  const userId = data.user.id;
  try {
    await withRls(me.claims, async (tx) => {
      await tx.update(profiles).set({ name, phone, mustChangePassword: true }).where(eq(profiles.id, userId));
      await tx.insert(userRoles).values({ userId, unitId, role });
    });
  } catch (err) {
    // Batalkan akun auth agar tidak ada akun tanpa peran yang valid.
    await admin.auth.admin.deleteUser(userId);
    return { error: dbErrorMessage(err), values };
  }

  revalidatePath("/admin/akun");
  return { ok: `Akun ${name} dibuat.`, tempPassword, accountId: userId, email };
}

const profileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2, "Nama minimal 2 huruf"),
  phone: optionalText,
});

export async function updateProfile(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const me = await requireSuperadmin();
  const values = formValues(formData);
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const { id, name, phone } = parsed.data;
  try {
    await withRls(me.claims, (tx) => tx.update(profiles).set({ name, phone }).where(eq(profiles.id, id)));
  } catch (err) {
    return { error: dbErrorMessage(err), values };
  }
  revalidatePath(`/admin/akun/${id}`);
  return { ok: "Profil disimpan.", values };
}

const roleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(ROLES, { message: "Pilih peran" }),
  unitId: z.string().uuid("Pilih unit"),
});

export async function addRole(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const me = await requireSuperadmin();
  const values = formValues(formData);
  const parsed = roleSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  try {
    await withRls(me.claims, (tx) => tx.insert(userRoles).values(parsed.data));
  } catch (err) {
    return { error: dbErrorMessage(err), values };
  }
  revalidatePath(`/admin/akun/${parsed.data.userId}`);
  return { ok: "Peran ditambahkan." };
}

export async function removeRole(formData: FormData) {
  const me = await requireSuperadmin();
  const userId = z.string().uuid().parse(formData.get("userId"));
  const roleId = z.string().uuid().parse(formData.get("roleId"));
  await withRls(me.claims, async (tx) => {
    const [target] = await tx.select().from(userRoles).where(eq(userRoles.id, roleId));
    // Cegah superadmin mengunci dirinya sendiri.
    if (target?.userId === me.id && target.role === "superadmin") return;
    await tx.delete(userRoles).where(and(eq(userRoles.id, roleId), eq(userRoles.userId, userId)));
  });
  revalidatePath(`/admin/akun/${userId}`);
}

export async function setActive(formData: FormData) {
  const me = await requireSuperadmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const active = formData.get("active") === "true";
  if (id === me.id) redirect(`/admin/akun/${id}`);

  await withRls(me.claims, (tx) => tx.update(profiles).set({ active }).where(eq(profiles.id, id)));
  // Blokir juga di Auth agar tidak bisa login sama sekali selama nonaktif.
  await createSupabaseAdmin().auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
  revalidatePath(`/admin/akun/${id}`);
  revalidatePath("/admin/akun");
}

export async function resetPassword(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const me = await requireSuperadmin();
  const id = z.string().uuid().parse(formData.get("id"));
  if (id === me.id) return { error: "Untuk akun sendiri, gunakan menu Ganti password." };

  const tempPassword = generateTempPassword();
  const { error } = await createSupabaseAdmin().auth.admin.updateUserById(id, { password: tempPassword });
  if (error) return { error: "Gagal mereset password." };
  await withRls(me.claims, (tx) => tx.update(profiles).set({ mustChangePassword: true }).where(eq(profiles.id, id)));
  revalidatePath(`/admin/akun/${id}`);
  return { ok: "Password direset.", tempPassword };
}
