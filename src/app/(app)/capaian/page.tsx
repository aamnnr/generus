import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "@/components/app-link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/page-header";
import { SegmentNav } from "@/components/segment-nav";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { canReadGenerus, getCurrentUser, rekapRootUnit } from "@/lib/auth";
import { getKelompokSummary, todayIso, type TargetSummary } from "@/lib/capaian";
import { groupTargets } from "@/lib/kurikulum";
import { ASPEK_LABEL, formatRange, percent } from "@/lib/kurikulum-format";
import { dateRange } from "../kurikulum/shared";
import { kelompokGroups, resolveCapaianContext } from "./context";
import { DeliveryToggle, QuerySelect } from "./forms";
import { ProgressBar } from "./shared";
import { PageLoading } from "@/components/page-loading";

export const metadata: Metadata = { title: "Capaian · Generus" };

export default function CapaianPage({ searchParams }: PageProps<"/capaian">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Capaian searchParams={searchParams} />
    </Suspense>
  );
}

async function Capaian({ searchParams }: Pick<PageProps<"/capaian">, "searchParams">) {
  const [me, sp] = await Promise.all([getCurrentUser(), searchParams]);
  if (!canReadGenerus(me)) redirect("/kurikulum");
  const ctx = await resolveCapaianContext(me, sp);
  const { period, kelompok, current, writer } = ctx;

  if (!period || !kelompok) {
    return (
      <>
        <PageHeader title="Capaian" description="Capaian target materi per kelompok." />
        <EmptyState
          title={!period ? "Belum ada periode target yang terbit" : "Tidak ada kelompok dalam lingkup Anda"}
          description={!period ? "Capaian bisa diisi setelah Tim Kurikulum menerbitkan target periode." : undefined}
        />
      </>
    );
  }

  const targets = await getKelompokSummary(me.claims, period.id, current.id, kelompok.id);
  const groups = groupTargets(targets);
  const counted = targets.filter((t) => !t.optional && (t.kitab || t.materi?.assessment === "generus"));
  const tuntas = counted.reduce((s, t) => s + t.tuntas, 0);
  const slots = counted.reduce((s, t) => s + t.total, 0);
  const perKelompok = targets.filter((t) => !t.optional && t.materi?.assessment === "kelompok");
  const today = todayIso();

  return (
    <>
      <PageHeader
        title="Capaian"
        description={`Periode ${period.name} · ${dateRange(period.startsOn, period.endsOn)} · Kelompok ${kelompok.name}`}
        actions={
          rekapRootUnit(me) && (
            <Link href={`/capaian/rekap?periode=${period.id}&jenjang=${current.id}`} className={buttonVariants({ variant: "outline" })}>
              Rekap lintas kelompok
            </Link>
          )
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <QuerySelect name="periode" label="Periode" value={period.id} options={ctx.periods.map((p) => ({ value: p.id, label: `Periode ${p.name}` }))} />
        {ctx.kelompokList.length > 1 && <QuerySelect name="kelompok" label="Kelompok" value={kelompok.id} groups={kelompokGroups(ctx.kelompokList)} />}
      </div>

      <SegmentNav
        label="Jenjang"
        items={ctx.jenjang.map((j) => ({ href: `/capaian${ctx.query({ jenjang: j.id })}`, label: j.name, active: j.id === current.id }))}
      />

      {targets.length === 0 ? (
        <EmptyState title={`Belum ada target ${current.name} di periode ini`} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat
            label="Capaian materi & kitab per generus"
            value={`${percent(tuntas, slots)}%`}
            sub={`${tuntas.toLocaleString("id-ID")} dari ${slots.toLocaleString("id-ID")} tuntas`}
            bar={<ProgressBar done={tuntas} proses={counted.reduce((s, t) => s + t.proses, 0)} total={slots} />}
          />
          <Stat
            label="Materi per kelompok disampaikan"
            value={`${perKelompok.filter((t) => t.delivery).length}/${perKelompok.length}`}
            sub="Akhlaq, tata krama, kefahaman, kemandirian"
            bar={<ProgressBar done={perKelompok.filter((t) => t.delivery).length} proses={0} total={perKelompok.length} />}
          />
        </div>
      )}

      {groups.map((g) => (
        <Card key={g.aspek}>
          <CardHeader>
            <CardTitle>{ASPEK_LABEL[g.aspek]}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {g.mapel.map((mp) => (
              <section key={mp.mapel} className="flex flex-col gap-1">
                <h3 className="border-b border-muted pb-2 font-bold text-primary">{mp.mapel}</h3>
                <ul className="flex flex-col divide-y divide-muted">
                  {mp.targets.map((t) => (
                    <li key={t.id} className="py-2.5">
                      <TargetLine t={t} href={(path) => `${path}${ctx.query()}`} kelompokId={kelompok.id} writer={writer} today={today} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </CardContent>
        </Card>
      ))}
    </>
  );
}

function Stat({ label, value, sub, bar }: { label: string; value: string; sub: string; bar: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-card">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="font-heading text-[28px] leading-none font-bold tabular-nums">{value}</span>
      {bar}
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  );
}

function TargetLine({
  t,
  href,
  kelompokId,
  writer,
  today,
}: {
  t: TargetSummary;
  href: (path: string) => string;
  kelompokId: string;
  writer: boolean;
  today: string;
}) {
  const title = t.kitab ? `${t.kitab.title}${t.note ? ` · ${t.note}` : ""}` : t.materi!.title;
  const sub = t.kitab ? formatRange(t.kitab.unit, t.kitab.from, t.kitab.to) : null;
  const tags = [t.gender === "L" ? "Putra" : t.gender === "P" ? "Putri" : null, t.kategoriName, t.optional ? "Pilihan" : null].filter(Boolean).join(" · ");

  if (t.materi?.assessment === "kelompok") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex min-w-0 flex-[1_1_220px] flex-col">
          <span className="text-sm font-medium">{title}</span>
          {tags && <span className="text-xs text-muted-foreground">{tags}</span>}
        </span>
        {writer ? (
          <DeliveryToggle targetId={t.id} kelompokId={kelompokId} deliveredOn={t.delivery?.deliveredOn ?? null} today={today} />
        ) : (
          <span className={`text-[13px] font-semibold ${t.delivery ? "text-status-hadir" : "text-muted-foreground"}`}>
            {t.delivery ? "Sudah disampaikan" : "Belum disampaikan"}
          </span>
        )}
      </div>
    );
  }

  const path = t.kitab ? `/capaian/kitab/${t.id}` : `/capaian/target/${t.id}`;
  return (
    <Link href={href(path)} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-secondary/40">
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-sm font-medium">
          {title}
          {sub && <span className="font-normal text-muted-foreground"> · {sub}</span>}
        </span>
        {tags && <span className="text-xs text-muted-foreground">{tags}</span>}
        <ProgressBar done={t.tuntas} proses={t.proses} total={t.total} />
      </span>
      <span className="w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        <span className="block text-sm font-bold text-foreground">
          {t.tuntas}/{t.total}
        </span>
        tuntas
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
