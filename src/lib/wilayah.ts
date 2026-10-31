import "server-only";
import { asc, sql } from "drizzle-orm";
import { generus, units } from "@/db/schema";
import { withRls } from "@/db/rls";
import type { CurrentUser } from "@/lib/auth";

export interface KelompokNode {
  id: string;
  name: string;
  generusAktif: number;
}

export interface DesaNode {
  id: string;
  name: string;
  generusAktif: number;
  kelompok: KelompokNode[];
}

export interface DaerahNode {
  id: string;
  name: string;
  generusAktif: number;
  desa: DesaNode[];
}

/**
 * Daerah yang boleh dikelola user (superadmin sistem: semua; superadmin daerah:
 * daerah tempat perannya) beserta desa → kelompok dan jumlah generus aktif.
 * Nama unit terbaca semua akun, jadi penyaringan lingkup dilakukan di sini.
 */
export async function getWilayahTree(me: CurrentUser): Promise<DaerahNode[]> {
  const own = new Set(me.roles.filter((r) => r.role === "superadmin").map((r) => r.unitId));
  return withRls(me.claims, async (tx) => {
    const all = await tx
      .select({ id: units.id, name: units.name, level: units.level, parentId: units.parentId })
      .from(units)
      .orderBy(asc(units.name));
    const counts = await tx
      .select({ kelompokId: generus.kelompokId, n: sql<number>`count(*)::int` })
      .from(generus)
      .where(sql`${generus.status} = 'aktif'`)
      .groupBy(generus.kelompokId);
    const countOf = new Map(counts.map((c) => [c.kelompokId, c.n]));

    return all
      .filter((d) => d.level === "daerah" && (me.isSystemAdmin || own.has(d.id)))
      .map((d) => {
        const desa = all
          .filter((x) => x.parentId === d.id)
          .map((x) => {
            const kelompok = all
              .filter((k) => k.parentId === x.id)
              .map((k) => ({ id: k.id, name: k.name, generusAktif: countOf.get(k.id) ?? 0 }));
            return { id: x.id, name: x.name, kelompok, generusAktif: kelompok.reduce((s, k) => s + k.generusAktif, 0) };
          });
        return { id: d.id, name: d.name, desa, generusAktif: desa.reduce((s, x) => s + x.generusAktif, 0) };
      });
  });
}
