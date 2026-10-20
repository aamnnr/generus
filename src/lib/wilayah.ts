import "server-only";
import { asc, sql } from "drizzle-orm";
import { generus, units } from "@/db/schema";
import { withRls, type JwtClaims } from "@/db/rls";

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

export interface WilayahTree {
  daerah: { id: string; name: string; generusAktif: number } | null;
  desa: DesaNode[];
}

/** Pohon daerah → desa → kelompok beserta jumlah generus aktif. */
export async function getWilayahTree(claims: JwtClaims): Promise<WilayahTree> {
  return withRls(claims, async (tx) => {
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

    const desa = all
      .filter((u) => u.level === "desa")
      .map((d) => {
        const kelompok = all
          .filter((k) => k.parentId === d.id)
          .map((k) => ({ id: k.id, name: k.name, generusAktif: countOf.get(k.id) ?? 0 }));
        return { id: d.id, name: d.name, kelompok, generusAktif: kelompok.reduce((s, k) => s + k.generusAktif, 0) };
      });
    const d = all.find((u) => u.level === "daerah");
    return {
      daerah: d ? { id: d.id, name: d.name, generusAktif: desa.reduce((s, x) => s + x.generusAktif, 0) } : null,
      desa,
    };
  });
}
