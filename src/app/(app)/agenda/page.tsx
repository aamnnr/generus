import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { EmptyState, PageHeader, Pill } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { listAgendas, lockDueAgendas, type AgendaListItem } from "@/lib/agenda";
import { canReadGenerus, canWriteGenerus, getCurrentUser } from "@/lib/auth";
import { formatDateLong, formatTime, utcToZoned, zoneLabel } from "@/lib/time";

export const metadata: Metadata = { title: "Agenda · Generus" };

const LEVEL = { daerah: "Daerah", desa: "Desa", kelompok: "Kelompok" } as const;

export default function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Memuat…</p>}>
      <AgendaList searchParams={searchParams} />
    </Suspense>
  );
}

async function AgendaList({ searchParams }: Pick<PageProps<"/agenda">, "searchParams">) {
  const [me, sp] = await Promise.all([getCurrentUser(), searchParams]);
  if (!canReadGenerus(me)) redirect("/beranda");
  const range = sp.tab === "selesai" ? "selesai" : "mendatang";
  const page = Math.max(1, Number(sp.page) || 1);

  await lockDueAgendas(me.claims);
  const { rows, hasMore } = await listAgendas(me.claims, range, page);

  const byDate = new Map<string, AgendaListItem[]>();
  for (const a of rows) {
    const key = utcToZoned(a.startsAt).date;
    byDate.set(key, [...(byDate.get(key) ?? []), a]);
  }
  const now = new Date();
  const tab = (t: "mendatang" | "selesai", label: string) => (
    <Link
      href={t === "mendatang" ? "/agenda" : "/agenda?tab=selesai"}
      aria-current={range === t ? "page" : undefined}
      className={`flex h-9 flex-1 items-center justify-center rounded-full px-4 text-sm whitespace-nowrap sm:flex-none ${
        range === t ? "bg-card font-semibold text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Agenda"
        description={`Pengajian yang Anda kelola atau ikuti · waktu dalam ${zoneLabel()}`}
        actions={
          canWriteGenerus(me) && (
            <Link href="/agenda/baru" className={buttonVariants()}>
              <Plus aria-hidden /> Buat agenda
            </Link>
          )
        }
      />
      <nav aria-label="Rentang agenda" className="flex w-full gap-1 rounded-full bg-muted p-1 sm:w-fit">
        {tab("mendatang", "Mendatang & berlangsung")}
        {tab("selesai", "Selesai")}
      </nav>

      {rows.length === 0 && (
        <EmptyState
          title={range === "mendatang" ? "Belum ada agenda mendatang" : "Belum ada agenda yang selesai"}
          description={range === "mendatang" && canWriteGenerus(me) ? "Buat agenda pengajian, sekali atau berulang setiap pekan." : undefined}
        />
      )}

      <div className="flex flex-col gap-6">
        {[...byDate].map(([date, items]) => (
          <section key={date} className="flex flex-col gap-2">
            <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{formatDateLong(items[0].startsAt)}</h2>
            <ul className="flex flex-col gap-2">
              {items.map((a) => {
                const ongoing = !a.cancelledAt && a.startsAt <= now && now < a.endsAt;
                return (
                  <li key={a.id}>
                    <Link href={`/agenda/${a.id}`} className="flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-card hover:bg-secondary/40 md:gap-4 md:px-5">
                      <span className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-tile py-1.5 text-center leading-tight md:w-16">
                        <span className="text-sm font-bold tabular-nums">{formatTime(a.startsAt)}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">{formatTime(a.endsAt)}</span>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={`truncate font-semibold ${a.cancelledAt ? "text-muted-foreground line-through" : ""}`}>{a.title}</span>
                        <span className="truncate text-[13px] text-muted-foreground">
                          {LEVEL[a.level]} {a.unitName}
                          {a.location ? ` · ${a.location}` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                        {ongoing && <Pill tone="ok">Berlangsung</Pill>}
                        {a.cancelledAt ? <Pill tone="danger">Batal</Pill> : a.lockedAt ? <Pill tone="muted">Terkunci</Pill> : null}
                        <Pill>{LEVEL[a.level]}</Pill>
                      </span>
                      <ChevronRight className="hidden size-5 shrink-0 text-muted-foreground sm:block" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm">
        {page > 1 ? (
          <Link href={`/agenda?${new URLSearchParams({ ...(range === "selesai" ? { tab: "selesai" } : {}), page: String(page - 1) })}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            ← Sebelumnya
          </Link>
        ) : (
          <span />
        )}
        <span className="text-xs text-muted-foreground">Halaman {page}</span>
        {hasMore ? (
          <Link href={`/agenda?${new URLSearchParams({ ...(range === "selesai" ? { tab: "selesai" } : {}), page: String(page + 1) })}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Berikutnya →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </>
  );
}
