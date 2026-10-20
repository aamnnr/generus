import "server-only";
import { canWriteGenerus, type CurrentUser } from "@/lib/auth";
import { listPublishedPeriods, pickActivePeriod } from "@/lib/capaian";
import { listScopeUnits } from "@/lib/generus";
import { listJenjangWithKategori } from "@/lib/kurikulum";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** Periode, kelompok, dan jenjang terpilih untuk halaman capaian (dari query string). */
export async function resolveCapaianContext(me: CurrentUser, sp: Search) {
  const writer = canWriteGenerus(me);
  const [periods, units, jenjang] = await Promise.all([
    listPublishedPeriods(me.claims),
    listScopeUnits(me.claims, writer ? "write" : "read"),
    listJenjangWithKategori(me.claims),
  ]);
  const kelompokList = units.filter((u) => u.level === "kelompok");
  const period = periods.find((p) => p.id === one(sp.periode)) ?? pickActivePeriod(periods);
  const kelompok = kelompokList.find((k) => k.id === one(sp.kelompok)) ?? kelompokList[0] ?? null;
  const current = jenjang.find((j) => j.id === one(sp.jenjang)) ?? jenjang.find((j) => j.name === "Remaja") ?? jenjang[0];

  const query = (patch: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams();
    const next = { periode: period?.id, kelompok: kelompok?.id, jenjang: current?.id, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    return `?${p}`;
  };

  return { writer, periods, period, kelompokList, kelompok, jenjang, current, query };
}

/** Kelompok dikelompokkan per desa untuk <select>. */
export function kelompokGroups(list: { id: string; name: string; desaName: string }[]) {
  const map = new Map<string, { value: string; label: string }[]>();
  for (const k of list) map.set(k.desaName, [...(map.get(k.desaName) ?? []), { value: k.id, label: `Kelompok ${k.name}` }]);
  return [...map].map(([desa, options]) => ({ label: `Desa ${desa}`, options }));
}
