import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink, EmptyState, PageHeader, Pill } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canWriteGenerus, requireGenerusReader } from "@/lib/auth";
import { getGenerusCapaian, listPublishedPeriods, pickActivePeriod, todayIso, type GenerusCapaian } from "@/lib/capaian";
import { getGenerus, jenjangLabel } from "@/lib/generus";
import { ASPEK_LABEL, CAPAIAN_LABEL, formatPosition, formatRange, kitabStatus } from "@/lib/kurikulum-format";
import { dateRange } from "../../../kurikulum/shared";
import { GenerusAchievementForm, KitabSingleForm, QuerySelect } from "../../forms";

export const metadata: Metadata = { title: "Capaian generus · Generus" };

export default function GenerusCapaianPage(props: PageProps<"/capaian/generus/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Memuat…</p>}>
      <Detail {...props} />
    </Suspense>
  );
}

const TONE = { belum: "muted", proses: "accent", tuntas: "ok" } as const;

function label(t: GenerusCapaian) {
  return (
    <>
      <span className="font-medium">{t.materi?.title}</span>
      <span className="block text-xs text-muted-foreground">
        {ASPEK_LABEL[t.aspek]} · {t.mapel}
        {t.optional && " · pilihan"}
      </span>
    </>
  );
}

async function Detail({ params, searchParams }: PageProps<"/capaian/generus/[id]">) {
  const [me, { id }, sp] = await Promise.all([requireGenerusReader(), params, searchParams]);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [g, periods] = await Promise.all([getGenerus(me.claims, id), listPublishedPeriods(me.claims)]);
  if (!g) notFound();
  const period = periods.find((p) => p.id === sp.periode) ?? pickActivePeriod(periods);
  const writer = canWriteGenerus(me);
  const items = period ? await getGenerusCapaian(me.claims, g.id, period.id) : [];
  const perGenerus = items.filter((t) => t.materi?.assessment === "generus");
  const kitab = items.filter((t) => t.kitab);
  const perKelompok = items.filter((t) => t.materi?.assessment === "kelompok");
  const today = todayIso();

  return (
    <>
      <BackLink href={`/generus/${g.id}`}>Kembali ke {g.name}</BackLink>
      <PageHeader
        title={`Capaian ${g.name}`}
        description={`${jenjangLabel(g.jenjang, g.kategori)} · Kelompok ${g.kelompok}${period ? ` · ${dateRange(period.startsOn, period.endsOn)}` : ""}`}
      />
      {periods.length > 1 && period && (
        <QuerySelect name="periode" label="Periode" value={period.id} options={periods.map((p) => ({ value: p.id, label: `Periode ${p.name}` }))} />
      )}

      {!period && <EmptyState title="Belum ada periode target yang terbit" />}
      {period && items.length === 0 && <EmptyState title="Tidak ada target untuk generus ini di periode ini" />}

      {kitab.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bacaan & makna</CardTitle>
            <CardDescription>Posisi terakhir dibandingkan rentang target periode.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-muted">
            {kitab.map((t) => {
              const k = t.kitab!;
              const s = kitabStatus(t.position, k.from, k.to);
              return (
                <div key={t.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{k.title}</span>
                    <Pill tone={TONE[s]}>{CAPAIAN_LABEL[s]}</Pill>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Target {formatRange(k.unit, k.from, k.to)} · Terakhir:{" "}
                    <span className="font-semibold text-foreground">{t.position ? formatPosition(k.unit, t.position) : "belum dicatat"}</span>
                  </p>
                  {writer && <KitabSingleForm kitab={{ id: k.id, unit: k.unit, total: k.total }} generusId={g.id} today={today} />}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {perGenerus.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Materi per generus</CardTitle>
          </CardHeader>
          <CardContent>
            {writer ? (
              <GenerusAchievementForm generusId={g.id} items={perGenerus.map((t) => ({ targetId: t.id, status: t.status, label: label(t) }))} />
            ) : (
              <ul className="flex flex-col divide-y divide-muted">
                {perGenerus.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="min-w-0 flex-1">{label(t)}</span>
                    <Pill tone={TONE[t.status]}>{CAPAIAN_LABEL[t.status]}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {perKelompok.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Materi per kelompok</CardTitle>
            <CardDescription>Ditandai oleh admin kelompok di halaman Capaian.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-muted">
              {perKelompok.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">{label(t)}</span>
                  <Pill tone={t.deliveredOn ? "ok" : "muted"}>{t.deliveredOn ? "Disampaikan" : "Belum"}</Pill>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
