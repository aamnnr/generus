import "server-only";
import { asc, eq, ilike, or } from "drizzle-orm";
import { profiles, units, userRoles } from "@/db/schema";
import { withRls, type JwtClaims } from "@/db/rls";
import type { AppRole, CurrentUser, UnitLevel, UserRole } from "@/lib/auth";

// Query data akun. Semua lewat RLS: superadmin sistem melihat seluruh akun,
// superadmin daerah hanya akun yang berperan di daerahnya.

export interface AccountRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  mustChangePassword: boolean;
  roles: (UserRole & { id: string })[];
}

export async function listAccounts(claims: JwtClaims, q?: string): Promise<AccountRow[]> {
  return withRls(claims, async (tx) => {
    const term = q?.trim();
    const rows = await tx
      .select({
        id: profiles.id,
        name: profiles.name,
        email: profiles.email,
        phone: profiles.phone,
        active: profiles.active,
        mustChangePassword: profiles.mustChangePassword,
        roleId: userRoles.id,
        role: userRoles.role,
        unitId: units.id,
        unitName: units.name,
        level: units.level,
      })
      .from(profiles)
      .leftJoin(userRoles, eq(userRoles.userId, profiles.id))
      .leftJoin(units, eq(units.id, userRoles.unitId))
      .where(term ? or(ilike(profiles.name, `%${term}%`), ilike(profiles.email, `%${term}%`)) : undefined)
      .orderBy(asc(profiles.name), asc(units.path));
    return groupAccounts(rows);
  });
}

export async function getAccount(claims: JwtClaims, id: string): Promise<AccountRow | null> {
  return withRls(claims, async (tx) => {
    const rows = await tx
      .select({
        id: profiles.id,
        name: profiles.name,
        email: profiles.email,
        phone: profiles.phone,
        active: profiles.active,
        mustChangePassword: profiles.mustChangePassword,
        roleId: userRoles.id,
        role: userRoles.role,
        unitId: units.id,
        unitName: units.name,
        level: units.level,
      })
      .from(profiles)
      .leftJoin(userRoles, eq(userRoles.userId, profiles.id))
      .leftJoin(units, eq(units.id, userRoles.unitId))
      .where(eq(profiles.id, id))
      .orderBy(asc(units.path));
    return groupAccounts(rows)[0] ?? null;
  });
}

type FlatRow = Omit<AccountRow, "roles"> & {
  roleId: string | null;
  role: AppRole | null;
  unitId: string | null;
  unitName: string | null;
  level: UnitLevel | null;
};

function groupAccounts(rows: FlatRow[]): AccountRow[] {
  const byId = new Map<string, AccountRow>();
  for (const { roleId, role, unitId, unitName, level, ...p } of rows) {
    let acc = byId.get(p.id);
    if (!acc) byId.set(p.id, (acc = { ...p, roles: [] }));
    if (roleId && role && unitId && unitName && level) acc.roles.push({ id: roleId, role, unitId, unitName, level });
  }
  return [...byId.values()];
}

export interface UnitOption {
  id: string;
  name: string;
  level: UnitLevel;
}

export interface UnitGroup {
  label: string;
  options: UnitOption[];
}

/**
 * Unit untuk pilihan peran: daerah, lalu tiap desa diikuti kelompok-kelompoknya.
 * Hanya daerah dalam lingkup pemanggil (superadmin sistem: semua).
 */
export async function listUnitGroups(me: CurrentUser): Promise<UnitGroup[]> {
  const own = new Set(me.roles.filter((r) => r.role === "superadmin").map((r) => r.unitId));
  const all = await withRls(me.claims, (tx) =>
    tx
      .select({ id: units.id, name: units.name, level: units.level, parentId: units.parentId })
      .from(units)
      .orderBy(asc(units.name)),
  );
  const daerah = all.filter((u) => u.level === "daerah" && (me.isSystemAdmin || own.has(u.id)));
  const groups: UnitGroup[] = [{ label: "Daerah", options: daerah }];
  for (const d of daerah) {
    for (const desa of all.filter((u) => u.parentId === d.id)) {
      groups.push({
        label: daerah.length > 1 ? `Desa ${desa.name} · ${d.name}` : `Desa ${desa.name}`,
        options: [desa, ...all.filter((u) => u.parentId === desa.id)],
      });
    }
  }
  return groups;
}
