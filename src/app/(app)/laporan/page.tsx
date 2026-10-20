import { Fragment, Suspense } from "react";
import type { Metadata } from "next";
import Link from "@/components/app-link";
import { redirect } from "next/navigation";
import { AlertTriangle, ChevronRight, Download } from "lucide-react";
import { EmptyState, PageHeader, Pill } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser, LEVEL_LABEL, rekapRootUnit } from "@/lib/auth";
import { getRekapUnits, getUnitWithChildren, listPublishedPeriods, todayIso, type RekapUnit, type UnitNode } from "@/lib/capaian";
import { percent } from "@/lib/kurikulum-format";
import {
  currentMonth,
  getKehadiranTren,
  getKehadiranUnits,
  getLaporanGenerus,
  getPeringatanAlpa,
  hadirRate,
  isMonth,
  laporanRootUnit,
  listKelompokUnder,
  monthLabel,
  monthRange,
  recentMonths,
  type KehadiranUnit,
} from "@/lib/laporan";
import { PrintButton } from "../generus/kartu/print-button";
import { QuerySelect } from "../capaian/forms";
import { ProgressBar } from "../capaian/shared";
import { PageLoading } from "@/components/page-loading";

export const metadata: Metadata = { title: "Laporan · Generus" };

export default function LaporanPage({ searchParams }: PageProps<"/laporan">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Laporan searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

function unitLabel(u: { level: keyof typeof LEVEL_LABEL; name: string }) {
  const level = LEVEL_LABEL[u.level];
  return u.name.toLowerCase().startsWith(level.toLowerCase()) ? u.name : `${level} ${u.name}`;
}

async function Laporan({ searchParams }: Pick<PageProps<"/laporan">, "searchParams">) {
  const [me, sp] = await Promise.all([getCurrentUser(), searchParams]);
  const root = laporanRootUnit(me);
  if (!root) redirect(rekapRootUnit(me) ? "/capaian/rekap" : "/beranda");

  const month = isMonth(one(sp.bulan)) ? one(sp.bulan)! : currentMonth();
  const range = monthRange(month);
  const months = recentMonths(12);
  const [tree, periods] = await Promise.all([getUnitWithChildren(me.claims, one(sp.unit) ?? root.unitId), listPublishedPeriods(me.claims)]);
  if (!tree) redirect("/laporan");
  const unit = tree.unit;
  const isKelompok = unit.level === "kelompok";
  // Periode target yang beririsan dengan bulan laporan (terbaru dulu).
  const period = periods.find((p) => p.startsOn <= range.endIso && p.endsOn >= range.startIso) ?? null;
  const today = todayIso();
  const nearEnd = period && today <= period.endsOn && daysBetween(today, period.endsOn) <= 7;

  const unitIds = [unit.id, ...tree.children.map((c) => c.id)];
  const [kehadiran, tren, alpa, kelompok, generus] = await Promise.all([
    getKehadiranUnits(me.claims, range.from, range.to, unitIds),
    getKehadiranTren(me.claims, unit.id, recentMonths(6, month)),
    getPeringatanAlpa(me.claims, unit.id),
    isKelompok ? Promise.resolve([{ id: unit.id, name: unit.name }]) : listKelompokUnder(me.claims, unit.id),
    isKelompok ? getLaporanGenerus(me.claims, range.from, range.to, unit.id, period?.id ?? null) : Promise.resolve([]),
  ]);
  const total = kehadiran.find((k) => k.unitId === unit.id);
  if (!total) redirect("/laporan");
  const capaian = period ? await getRekapUnits(me.claims, period.id, null, [...new Set([...unitIds, ...kelompok.map((k) => k.id)])]) : [];
  const capOf = (id: string) => capaian.find((c) => c.unitId === id);
  const unitCap = capOf(unit.id);
  // Kelompok yang belum mengisi capaian sama sekali di periode ini.
  const kosong = period ? kelompok.filter((k) => {
    const c = capOf(k.id);
    return c && c.slots + c.deliverable > 0 && c.tuntas + c.proses + c.delivered === 0;
  }) : [];

  const query = (patch: Record<string, string>) => `?${new URLSearchParams({ bulan: month, unit: unit.id, ...patch })}`;
  const childLabel = unit.level === "daerah" ? "Desa" : "Kelompok";

  return (
    <>
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Laporan Bulanan Generus · {range.label}</h1>
        <p className="text-sm">{unitLabel(unit)}{period ? ` · Target Periode ${period.name}` : ""}</p>
      </div>
      <PageHeader
        title="Laporan"
        description={`${range.label} · ${unitLabel(unit)}`}
        actions={
          <>
            <a href={`/laporan/ekspor${query({})}`} className={buttonVariants({ variant: "outline" })}>
              <Download aria-hidden /> Unduh Excel
            </a>
            <PrintButton />
          </>
        }
      />

      {tree.ancestors.length > 0 && (
        <nav aria-label="Jalur wilayah" className="-mt-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground print:hidden">
          {[...tree.ancestors, unit].map((u, i, all) => (
            <Fragment key={u.id}>
              {i > 0 && <ChevronRight className="size-4" aria-hidden />}
              {i < all.length - 1 ? (
                <Link href={`/laporan${query({ unit: u.id })}`} className="font-medium text-primary hover:underline">
                  {unitLabel(u)}
                </Link>
              ) : (
                <span className="font-semibold text-foreground">{unitLabel(u)}</span>
              )}
            </Fragment>
          ))}
        </nav>
      )}

      <div className="flex print:hidden">
        <QuerySelect name="bulan" label="Bulan" value={month} options={months.map((m) => ({ value: m, label: monthLabel(m) }))} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Kehadiran" value={hadirRate(total) === null ? "–" : `${hadirRate(total)}%`} sub={`${(total.hadir + total.terlambat).toLocaleString("id-ID")} dari ${total.total.toLocaleString("id-ID")} presensi`}>
          <ProgressBar done={total.hadir} proses={total.terlambat} total={total.total} />
        </Stat>
        <Stat label="Agenda terkunci" value={String(total.agendas)} sub={`${total.generus.toLocaleString("id-ID")} generus aktif`} />
        <Stat label="Alpa" value={total.alpa.toLocaleString("id-ID")} sub={`izin ${total.izin} · sakit ${total.sakit}`} />
        <Stat
          label="Capaian target"
          value={unitCap && unitCap.slots ? `${percent(unitCap.tuntas, unitCap.slots)}%` : "–"}
          sub={period ? `Periode ${period.name}` : "Tidak ada periode target"}
        >
          {unitCap && <ProgressBar done={unitCap.tuntas} proses={unitCap.proses} total={unitCap.slots} />}
        </Stat>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tren kehadiran</CardTitle>
            <CardDescription>6 bulan terakhir · agenda yang sudah dikunci</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-36 items-end gap-2">
              {tren.map((t) => (
                <div key={t.month} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-semibold tabular-nums">{t.rate === null ? "–" : `${t.rate}%`}</span>
                  <div className="flex h-24 w-full items-end rounded-md bg-muted">
                    <div
                      className={`w-full rounded-md ${t.month === month ? "bg-primary" : "bg-primary/50"}`}
                      style={{ height: `${t.rate ?? 0}%` }}
                      aria-hidden
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{monthLabel(t.month).slice(0, 3)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-status-alpa" aria-hidden /> Peringatan
            </CardTitle>
            <CardDescription>Alpa 3× berturut-turut & kelompok yang belum mengisi capaian.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">
                Alpa 3× berturut-turut <Pill tone={alpa.length ? "danger" : "ok"}>{alpa.length} generus</Pill>
              </h3>
              {alpa.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {alpa.slice(0, 8).map((a) => (
                    <li key={a.generusId} className="relative -mx-2 flex justify-between gap-2 rounded-lg px-2 py-0.5 hover:bg-secondary/40">
                      <Link href={`/generus/${a.generusId}`} className="min-w-0 truncate font-medium after:absolute after:inset-0 after:content-['']">
                        {a.name}
                      </Link>
                      <span className="shrink-0 text-muted-foreground">Kelompok {a.kelompok}</span>
                    </li>
                  ))}
                  {alpa.length > 8 && <li className="text-muted-foreground">dan {alpa.length - 8} lainnya (lihat Excel)</li>}
                </ul>
              )}
            </section>
            {period && (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">
                  Capaian belum diisi{" "}
                  <Pill tone={kosong.length === 0 ? "ok" : nearEnd ? "danger" : "muted"}>{kosong.length} kelompok</Pill>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Periode {period.name} berakhir {new Date(`${period.endsOn}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long" })}
                  {nearEnd && " — kurang dari sepekan lagi"}.
                </p>
                {kosong.length > 0 && (
                  <p className="text-sm">{kosong.slice(0, 12).map((k) => k.name).join(", ")}{kosong.length > 12 && `, dan ${kosong.length - 12} lainnya`}</p>
                )}
              </section>
            )}
          </CardContent>
        </Card>
      </div>

      {!isKelompok && (
        <UnitTable
          title={`Per ${childLabel.toLowerCase()}`}
          rows={tree.children}
          kehadiran={kehadiran}
          capaian={capOf}
          href={(c) => `/laporan${query({ unit: c.id })}`}
          label={unitLabel}
        />
      )}

      {isKelompok && (
        <Card>
          <CardHeader>
            <CardTitle>Per generus</CardTitle>
            <CardDescription>Presensi {range.label}{period ? ` · capaian Periode ${period.name}` : ""}</CardDescription>
          </CardHeader>
          <CardContent>
            {generus.length === 0 ? (
              <EmptyState title="Belum ada data" />
            ) : (
              <div className="-mx-4 overflow-x-auto md:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="pl-4 md:pl-2">Nama</TableHead>
                      <TableHead className="text-right">Hadir</TableHead>
                      <TableHead className="text-right">Izin/Sakit</TableHead>
                      <TableHead className="text-right">Alpa</TableHead>
                      <TableHead className="text-right">Capaian</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generus.map((g) => (
                      <TableRow key={g.generusId} className="relative cursor-pointer hover:bg-secondary/50">
                        <TableCell className="pl-4 md:pl-2">
                          <Link href={`/generus/${g.generusId}`} className="font-medium hover:underline after:absolute after:inset-0 after:content-['']">
                            {g.name}
                          </Link>
                          <span className="ml-2 inline-flex gap-1">
                            {g.alpaStreak && <Pill tone="danger">Alpa 3×</Pill>}
                            {g.status !== "aktif" && <Pill tone="muted">Nonaktif</Pill>}
                          </span>
                          <span className="block text-xs text-muted-foreground">{g.kategori ? `${g.jenjang} ${g.kategori}` : g.jenjang}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {g.hadir + g.terlambat}/{g.total}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{g.izin + g.sakit}</TableCell>
                        <TableCell className={`text-right tabular-nums ${g.alpa ? "font-semibold text-status-alpa" : ""}`}>{g.alpa}</TableCell>
                        <TableCell className="text-right tabular-nums">{g.capSlots ? `${g.capTuntas}/${g.capSlots}` : "–"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function Stat({ label, value, sub, children }: { label: string; value: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-card print:border print:shadow-none">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="font-heading text-[28px] leading-none font-bold tabular-nums">{value}</span>
      {children}
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  );
}

function UnitTable({
  title,
  rows,
  kehadiran,
  capaian,
  href,
  label,
}: {
  title: string;
  rows: UnitNode[];
  kehadiran: KehadiranUnit[];
  capaian: (id: string) => RekapUnit | undefined;
  href: (u: UnitNode) => string;
  label: (u: UnitNode) => string;
}) {
  const items = rows
    .map((u) => ({ u, k: kehadiran.find((x) => x.unitId === u.id), c: capaian(u.id) }))
    .filter((x): x is { u: UnitNode; k: KehadiranUnit; c: RekapUnit | undefined } => !!x.k);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Kehadiran (hijau hadir, kuning terlambat) · H/I/S/A = hadir+terlambat / izin / sakit / alpa</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-muted">
          {items.map(({ u, k, c }) => {
            const rate = hadirRate(k);
            return (
              <li key={u.id}>
                <Link href={href(u)} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-secondary/40">
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="font-medium">{label(u)}</span>
                    <ProgressBar done={k.hadir} proses={k.terlambat} total={k.total} />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {k.generus} generus · {k.agendas} agenda · H {k.hadir + k.terlambat} / I {k.izin} / S {k.sakit} / A {k.alpa}
                      {c && c.slots > 0 && ` · capaian ${percent(c.tuntas, c.slots)}%`}
                    </span>
                  </span>
                  <span className="w-14 shrink-0 text-right text-lg font-bold tabular-nums">{rate === null ? "–" : `${rate}%`}</span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground print:hidden" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
