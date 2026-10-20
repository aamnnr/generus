import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
  const tab = (t: "mendatang" | "selesai", label: string) => (
    <Link
      href={t === "mendatang" ? "/agenda" : "/agenda?tab=selesai"}
      className={`rounded-md px-3 py-1.5 text-sm ${range === t ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Agenda</h1>
        {canWriteGenerus(me) && (
          <Link href="/agenda/baru" className={buttonVariants()}>
            Buat agenda
          </Link>
        )}
      </div>
      <nav className="flex gap-1">
        {tab("mendatang", "Mendatang & berlangsung")}
        {tab("selesai", "Selesai")}
      </nav>

      {rows.length === 0 && (
        <p className="text-muted-foreground">
          {range === "mendatang" ? "Belum ada agenda mendatang." : "Belum ada agenda yang selesai."}
        </p>
      )}

      <div className="flex flex-col gap-6">
        {[...byDate].map(([date, items]) => (
          <section key={date} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">{formatDateLong(items[0].startsAt)}</h2>
            <ul className="flex flex-col divide-y rounded-lg border">
              {items.map((a) => (
                <li key={a.id}>
                  <Link href={`/agenda/${a.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted/50">
                    <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
                      {formatTime(a.startsAt)}–{formatTime(a.endsAt)}
                    </span>
                    <span className={`font-medium ${a.cancelledAt ? "line-through text-muted-foreground" : ""}`}>{a.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {LEVEL[a.level]} {a.unitName}
                      {a.location ? ` · ${a.location}` : ""}
                    </span>
                    <span className="ml-auto flex gap-1">
                      <Badge variant="outline">{LEVEL[a.level]}</Badge>
                      {a.cancelledAt ? (
                        <Badge variant="destructive">Batal</Badge>
                      ) : a.lockedAt ? (
                        <Badge variant="secondary">Terkunci</Badge>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
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
        <span className="text-xs text-muted-foreground">Waktu dalam {zoneLabel()}</span>
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
