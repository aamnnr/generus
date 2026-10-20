import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "@/components/app-link";
import { notFound, redirect } from "next/navigation";
import { BackLink, EmptyState, PageHeader, Pill } from "@/components/page-header";
import { canReadGenerus, getCurrentUser } from "@/lib/auth";
import { getTarget, getTargetRoster, todayIso } from "@/lib/capaian";
import { CAPAIAN_LABEL, formatPosition, formatRange, kitabStatus } from "@/lib/kurikulum-format";
import { resolveCapaianContext } from "../../context";
import { KitabBulkForm } from "../../forms";
import { ProgressBar } from "../../shared";
import { PageLoading } from "@/components/page-loading";

export const metadata: Metadata = { title: "Progres kitab · Generus" };

export default function KitabCapaianPage(props: PageProps<"/capaian/kitab/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Progres {...props} />
    </Suspense>
  );
}

const GENDER = { L: "Laki-laki", P: "Perempuan" } as const;
const TONE = { belum: "muted", proses: "accent", tuntas: "ok" } as const;

async function Progres({ params, searchParams }: PageProps<"/capaian/kitab/[id]">) {
  const [me, { id }, sp] = await Promise.all([getCurrentUser(), params, searchParams]);
  if (!canReadGenerus(me)) redirect("/kurikulum");
  const [ctx, target] = await Promise.all([resolveCapaianContext(me, sp), getTarget(me.claims, id)]);
  if (!target?.kitab || !ctx.kelompok) notFound();
  const k = target.kitab;
  const rows = await getTargetRoster(me.claims, target.id, ctx.kelompok.id);
  const back = `/capaian${ctx.query({ periode: target.periodId, jenjang: target.jenjangId })}`;
  const status = rows.map((r) => kitabStatus(r.position, k.from, k.to));
  const done = status.filter((s) => s === "tuntas").length;
  const proses = status.filter((s) => s === "proses").length;

  return (
    <>
      <BackLink href={back}>Kembali ke capaian</BackLink>
      <PageHeader
        title={`${k.title}${target.note ? ` · ${target.note}` : ""}`}
        description={`Target ${formatRange(k.unit, k.from, k.to)} · Kelompok ${ctx.kelompok.name}`}
      />
      <div className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-card">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold">
            {done} dari {rows.length} sampai target
          </span>
          <span className="text-muted-foreground">{proses} sedang dalam rentang</span>
        </div>
        <ProgressBar done={done} proses={proses} total={rows.length} />
        <p className="text-xs text-muted-foreground">
          Pilih generus yang mengaji bersama, lalu catat posisi terakhir yang sama untuk semuanya.
        </p>
      </div>

      {rows.length === 0 && <EmptyState title="Tidak ada generus sasaran di kelompok ini" />}

      {rows.length > 0 &&
        (ctx.writer ? (
          <KitabBulkForm
            kitab={{ id: k.id, title: k.title, unit: k.unit, total: k.total }}
            range={{ from: k.from, to: k.to }}
            today={todayIso()}
            rows={rows.map((r) => ({
              generusId: r.generusId,
              name: r.name,
              meta: [GENDER[r.gender], r.kategori].filter(Boolean).join(" · "),
              position: r.position,
              recordedOn: r.recordedOn,
            }))}
          />
        ) : (
          <ul className="overflow-hidden rounded-2xl bg-card shadow-card">
            {rows.map((r, i) => (
              <li key={r.generusId} className={`relative flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 ${i < rows.length - 1 ? "border-b border-muted" : ""}`}>
                <Link href={`/generus/${r.generusId}`} className="min-w-0 flex-1 font-medium after:absolute after:inset-0 after:content-['']">
                  {r.name}
                </Link>
                <span className="text-sm text-muted-foreground">{r.position ? formatPosition(k.unit, r.position) : "–"}</span>
                <Pill tone={TONE[status[i]]}>{CAPAIAN_LABEL[status[i]]}</Pill>
              </li>
            ))}
          </ul>
        ))}
    </>
  );
}
