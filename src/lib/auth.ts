import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { asc, eq } from "drizzle-orm";
import { profiles, units, userRoles } from "@/db/schema";
import { withRls, type JwtClaims } from "@/db/rls";
import { createSupabaseServer } from "@/lib/supabase/server";

// Data Access Layer autentikasi. Semua pemeriksaan sesi lewat sini.

export type AppRole = "superadmin" | "kurikulum" | "admin" | "kyai";
export type UnitLevel = "daerah" | "desa" | "kelompok";

export interface UserRole {
  role: AppRole;
  unitId: string;
  unitName: string;
  level: UnitLevel;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string | null;
  mustChangePassword: boolean;
  roles: UserRole[];
  isSuperadmin: boolean;
  claims: JwtClaims;
}

/** Klaim JWT terverifikasi, atau null bila belum login. Di-dedupe per request. */
export const getSession = cache(async (): Promise<JwtClaims | null> => {
  // Klien auth Supabase memakai Date.now(); pastikan ini hanya jalan saat request.
  await connection();
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return data.claims as JwtClaims;
});

const loadUser = cache(async (claims: JwtClaims): Promise<CurrentUser | null> => {
  return withRls(claims, async (tx) => {
    const [profile] = await tx.select().from(profiles).where(eq(profiles.id, claims.sub));
    if (!profile || !profile.active) return null;
    const roles = await tx
      .select({ role: userRoles.role, unitId: units.id, unitName: units.name, level: units.level })
      .from(userRoles)
      .innerJoin(units, eq(units.id, userRoles.unitId))
      .where(eq(userRoles.userId, claims.sub))
      .orderBy(asc(units.path));
    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      mustChangePassword: profile.mustChangePassword,
      roles,
      isSuperadmin: roles.some((r) => r.role === "superadmin"),
      claims,
    };
  });
});

/**
 * User yang sedang login. Redirect ke /login bila belum login atau akun
 * nonaktif, dan ke halaman ganti password bila masih wajib ganti.
 */
export async function getCurrentUser(opts: { allowPasswordChange?: boolean } = {}): Promise<CurrentUser> {
  const claims = await getSession();
  if (!claims) redirect("/login");
  const user = await loadUser(claims);
  if (!user) redirect("/login?status=nonaktif");
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect("/akun/password");
  return user;
}

export async function requireSuperadmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user.isSuperadmin) redirect("/beranda");
  return user;
}

// Izin di UI. Ini hanya untuk menampilkan/menyembunyikan tombol; penegakan
// sebenarnya ada di RLS & trigger database.

/** Boleh melihat data generus (semua peran kecuali Tim Kurikulum). */
export function canReadGenerus(user: CurrentUser): boolean {
  return user.roles.some((r) => r.role !== "kurikulum");
}

/** Boleh menambah/mengubah generus di lingkupnya (admin & superadmin). */
export function canWriteGenerus(user: CurrentUser): boolean {
  return user.roles.some((r) => r.role === "admin" || r.role === "superadmin");
}

/** Boleh memindah generus antar kelompok (admin desa/daerah & superadmin). */
export function canMutateGenerus(user: CurrentUser): boolean {
  return user.roles.some((r) => r.role === "superadmin" || (r.role === "admin" && r.level !== "kelompok"));
}

export async function requireGenerusReader(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!canReadGenerus(user)) redirect("/beranda");
  return user;
}

export async function requireGenerusWriter(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!canWriteGenerus(user)) redirect("/generus");
  return user;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  superadmin: "Superadmin",
  kurikulum: "Tim Kurikulum",
  admin: "Admin",
  kyai: "Kyai",
};

export const LEVEL_LABEL: Record<UnitLevel, string> = {
  daerah: "Daerah",
  desa: "Desa",
  kelompok: "Kelompok",
};

export function roleLabel(r: Pick<UserRole, "role" | "level">): string {
  return r.role === "admin" || r.role === "kyai" ? `${ROLE_LABEL[r.role]} ${LEVEL_LABEL[r.level]}` : ROLE_LABEL[r.role];
}
