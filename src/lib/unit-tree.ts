import "server-only";
import { asc } from "drizzle-orm";
import { units } from "@/db/schema";
import { withRls, type JwtClaims } from "@/db/rls";
import type { TreeUnit } from "@/components/unit-picker";

/**
 * Pohon unit untuk UnitPicker: unit yang boleh dipilih (`selectableIds`) beserta
 * semua leluhurnya (daerah → desa) agar bisa ditampilkan berjenjang. Leluhur yang
 * tidak ada di `selectableIds` hanya menjadi judul cabang. Urutan mengikuti nama.
 */
export async function buildUnitTree(claims: JwtClaims, selectableIds: Iterable<string>): Promise<TreeUnit[]> {
  const pick = new Set(selectableIds);
  if (pick.size === 0) return [];
  const all = await withRls(claims, (tx) =>
    tx
      .select({ id: units.id, name: units.name, level: units.level, parentId: units.parentId })
      .from(units)
      .orderBy(asc(units.name)),
  );
  const byId = new Map(all.map((u) => [u.id, u]));
  const keep = new Set<string>();
  for (const id of pick) {
    for (let u = byId.get(id); u && !keep.has(u.id); u = u.parentId ? byId.get(u.parentId) : undefined) keep.add(u.id);
  }
  return all.filter((u) => keep.has(u.id)).map((u) => ({ ...u, selectable: pick.has(u.id) }));
}
