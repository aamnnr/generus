import type { Metadata } from "next";
import Link from "@/components/app-link";
import { ChevronRight, Plus } from "lucide-react";
import { EmptyState } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { canEditCurriculum, getCurrentUser } from "@/lib/auth";
import { listPeriods } from "@/lib/kurikulum";
import { dateRange, PeriodPills, todayIso } from "@/app/(app)/kurikulum/shared";

export const metadata: Metadata = { title: "Kurikulum · Generus" };

// Judul, tab, dan Suspense ada di (tabs)/layout.tsx.
export default async function KurikulumPage() {
  const me = await getCurrentUser();
  const editor = canEditCurriculum(me);
  const periods = await listPeriods(me.claims);
  const today = todayIso();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Target materi pembelajaran per periode dari Tim Kurikulum PPG.</p>
        {editor && (
          <Link href="/kurikulum/periode/baru" className={buttonVariants()}>
            <Plus aria-hidden /> Buat periode
          </Link>
        )}
      </div>

      {periods.length === 0 && (
        <EmptyState
          title="Belum ada periode target"
          description={editor ? "Buat periode pertama, lalu susun targetnya per jenjang." : "Target akan tampil setelah diterbitkan Tim Kurikulum."}
        />
      )}

      <ul className="flex flex-col gap-2">
        {periods.map((p) => (
          <li key={p.id}>
            <Link href={`/kurikulum/periode/${p.id}`} className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card hover:bg-secondary/40">
              <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-tile text-primary">
                <span className="text-[10px] font-semibold tracking-wide uppercase">
                  {new Date(`${p.startsOn}T00:00:00`).toLocaleDateString("id-ID", { month: "short" })}
                </span>
                <span className="text-sm leading-none font-bold">{p.startsOn.slice(0, 4)}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  Periode {p.name}
                  <PeriodPills p={p} today={today} />
                </span>
                <span className="text-[13px] text-muted-foreground">
                  Semester {p.semester} · {dateRange(p.startsOn, p.endsOn)} · {p.targetCount} target
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
