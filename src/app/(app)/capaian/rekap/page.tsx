import { Fragment, Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { EmptyState, PageHeader, Pill } from "@/components/page-header";
import { SegmentNav } from "@/components/segment-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canReadGenerus, getCurrentUser, LEVEL_LABEL, rekapRootUnit } from "@/lib/auth";
import { getRekapTargets, getRekapUnits, getUnitWithChildren, listPublishedPeriods, pickActivePeriod, type RekapTarget, type RekapUnit } from "@/lib/capaian";
import { groupTargets, listJenjangWithKategori, listTargets } from "@/lib/kurikulum";
import { ASPEK_LABEL, formatRange, percent } from "@/lib/kurikulum-format";
import { dateRange } from "../../kurikulum/shared";
import { QuerySelect } from "../forms";
import { ProgressBar } from "../shared";

export const metadata: Metadata = { title: "Rekap capaian · Generus" };

export default function RekapPage({ searchParams }: PageProps<"/capaian/rekap">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Memuat…</p>}>
      <Rekap searchParams={searchParams} />
    </Suspense>
  );
}

/** "Desa Cibeureum"; nama yang sudah diawali tingkatnya (mis. "Daerah Contoh") tidak diulang. */
function unitLabel(u: { level: keyof typeof LEVEL_LABEL; name: string }) {
  const level = LEVEL_LABEL[u.level];
  return u.name.toLowerCase().startsWith(level.toLowerCase()) ? u.name : `${level} ${u.name}`;
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function Rekap({ searchParams }: Pick<PageProps<"/capaian/rekap">, "searchParams">) {
  const [me, sp] = await Promise.all([getCurrentUser(), searchParams]);
  const root = rekapRootUnit(me);
  if (!root) redirect("/capaian");

  const [periods, jenjang, tree] = await Promise.all([
    listPublishedPeriods(me.claims),
    listJenjangWithKategori(me.claims),
    getUnitWithChildren(me.claims, one(sp.unit) ?? root.unitId),
  ]);
  const period = periods.find((p) => p.id === one(sp.periode)) ?? pickActivePeriod(periods);
  const jenjangId = one(sp.jenjang) === "semua" ? null : (jenjang.find((j) => j.id === one(sp.jenjang)) ?? jenjang.find((j) => j.name === "Remaja") ?? jenjang[0]).id;
  if (!tree) redirect("/capaian/rekap");
  const reader = canReadGenerus(me);

  const query = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const next = { periode: period?.id, jenjang: jenjangId ?? "semua", unit: tree.unit.id, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    return `?${p}`;
  };

  if (tree.unit.level === "kelompok" && reader) redirect(`/capaian?kelompok=${tree.unit.id}${period ? `&periode=${period.id}` : ""}${jenjangId ? `&jenjang=${jenjangId}` : ""}`);

  if (!period) {
    return (
      <>
        <PageHeader title="Rekap capaian" />
        <EmptyState title="Belum ada periode target yang terbit" />
      </>
    );
  }

  const [rows, targets, perTarget] = await Promise.all([
    getRekapUnits(me.claims, period.id, jenjangId, [tree.unit.id, ...tree.children.map((c) => c.id)]),
    jenjangId ? listTargets(me.claims, period.id, jenjangId) : Promise.resolve([]),
    jenjangId ? getRekapTargets(me.claims, period.id, jenjangId, tree.unit.id) : Promise.resolve(new Map<string, RekapTarget>()),
  ]);
  const total = rows.find((r) => r.unitId === tree.unit.id);
  if (!total) redirect("/capaian/rekap");
  const childRows = tree.children.map((c) => ({ ...c, r: rows.find((r) => r.unitId === c.id) })).filter((c) => c.r) as (typeof tree.children[number] & { r: RekapUnit })[];
  const pcts = childRows.filter((c) => c.r.slots > 0).map((c) => percent(c.r.tuntas, c.r.slots));
  // Tandai "terendah" hanya bila satu unit tertinggal sendiri (bukan seri).
  const min = Math.min(...pcts);
  const lowest = pcts.length > 1 && pcts.filter((p) => p === min).length === 1 ? min : null;

  const childLabel = tree.unit.level === "daerah" ? "Desa" : "Kelompok";
  const unitTitle = unitLabel(tree.unit);

  return (
    <>
      <PageHeader title="Rekap capaian" description={`Periode ${period.name} · ${dateRange(period.startsOn, period.endsOn)} · ${unitTitle}`} />

      {tree.ancestors.length > 0 && (
        <nav aria-label="Jalur wilayah" className="-mt-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {[...tree.ancestors, tree.unit].map((u, i, all) => (
            <Fragment key={u.id}>
              {i > 0 && <ChevronRight className="size-4" aria-hidden />}
              {i < all.length - 1 ? (
                <Link href={`/capaian/rekap${query({ unit: u.id })}`} className="font-medium text-primary hover:underline">
                  {unitLabel(u)}
                </Link>
              ) : (
                <span className="font-semibold text-foreground">{unitLabel(u)}</span>
              )}
            </Fragment>
          ))}
        </nav>
      )}

      {periods.length > 1 && (
        <QuerySelect name="periode" label="Periode" value={period.id} options={periods.map((p) => ({ value: p.id, label: `Periode ${p.name}` }))} />
      )}
      <SegmentNav
        label="Jenjang"
        items={[
          { href: `/capaian/rekap${query({ jenjang: "semua" })}`, label: "Semua", active: jenjangId === null },
          ...jenjang.map((j) => ({ href: `/capaian/rekap${query({ jenjang: j.id })}`, label: j.name, active: j.id === jenjangId })),
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Capaian per generus" value={`${percent(total.tuntas, total.slots)}%`} sub={`${total.tuntas.toLocaleString("id-ID")} dari ${total.slots.toLocaleString("id-ID")} tuntas`}>
          <ProgressBar done={total.tuntas} proses={total.proses} total={total.slots} />
        </Stat>
        <Stat label="Materi kelompok disampaikan" value={`${percent(total.delivered, total.deliverable)}%`} sub={`${total.delivered} dari ${total.deliverable} (materi × kelompok)`}>
          <ProgressBar done={total.delivered} proses={0} total={total.deliverable} />
        </Stat>
        <Stat label="Generus sasaran" value={total.generus.toLocaleString("id-ID")} sub={`${total.kelompok} kelompok`} />
      </div>

      {childRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Per {childLabel.toLowerCase()}</CardTitle>
            <CardDescription>Hijau = tuntas, kuning = proses. Urut nama.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-muted">
              {childRows.map((c) => {
                const pct = percent(c.r.tuntas, c.r.slots);
                const href =
                  c.level === "kelompok"
                    ? reader
                      ? `/capaian?kelompok=${c.id}&periode=${period.id}${jenjangId ? `&jenjang=${jenjangId}` : ""}`
                      : null
                    : `/capaian/rekap${query({ unit: c.id })}`;
                const body = (
                  <>
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        {childLabel} {c.name}
                        {lowest !== null && c.r.slots > 0 && pct === lowest && <Pill tone="danger">Terendah</Pill>}
                      </span>
                      <ProgressBar done={c.r.tuntas} proses={c.r.proses} total={c.r.slots} />
                      <span className="text-xs text-muted-foreground">
                        {c.r.generus} generus · disampaikan {c.r.delivered}/{c.r.deliverable}
                      </span>
                    </span>
                    <span className="w-14 shrink-0 text-right text-lg font-bold tabular-nums">{pct}%</span>
                    {href && <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
                  </>
                );
                return (
                  <li key={c.id}>
                    {href ? (
                      <Link href={href} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-secondary/40">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 py-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {jenjangId && targets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Per target</CardTitle>
            <CardDescription>Seluruh {unitTitle}. Materi per kelompok dihitung dari jumlah kelompok yang sudah menyampaikan.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {groupTargets(targets).map((g) => (
              <section key={g.aspek} className="flex flex-col gap-1">
                <h3 className="border-b border-muted pb-2 font-bold text-primary">{ASPEK_LABEL[g.aspek]}</h3>
                <ul className="flex flex-col divide-y divide-muted">
                  {g.mapel.flatMap((mp) => mp.targets).map((t) => {
                    const r = perTarget.get(t.id);
                    if (!r) return null;
                    const perKelompok = t.materi?.assessment === "kelompok";
                    const pct = perKelompok ? percent(r.delivered, r.kelompok) : percent(r.tuntas, r.slots);
                    return (
                      <li key={t.id} className="flex items-center gap-3 py-2.5">
                        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <span className="text-sm">
                            <span className="font-medium">{t.kitab ? t.kitab.title : t.materi?.title}</span>
                            <span className="text-muted-foreground">
                              {" "}
                              · {t.mapel}
                              {t.kitab && ` · ${formatRange(t.kitab.unit, t.kitab.from, t.kitab.to)}`}
                              {t.optional && " · pilihan"}
                            </span>
                          </span>
                          {perKelompok ? (
                            <ProgressBar done={r.delivered} proses={0} total={r.kelompok} />
                          ) : (
                            <ProgressBar done={r.tuntas} proses={r.proses} total={r.slots} />
                          )}
                        </span>
                        <span className="w-24 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                          <span className="block text-sm font-bold text-foreground">{t.optional ? "–" : `${pct}%`}</span>
                          {perKelompok ? `${r.delivered}/${r.kelompok} kelompok` : `${r.tuntas}/${r.slots} tuntas`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Stat({ label, value, sub, children }: { label: string; value: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-card">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="font-heading text-[28px] leading-none font-bold tabular-nums">{value}</span>
      {children}
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  );
}
