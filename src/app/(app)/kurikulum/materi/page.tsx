import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Search } from "lucide-react";
import { EmptyState, PageHeader, Pill } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireCurriculumEditor } from "@/lib/auth";
import { listMateri } from "@/lib/kurikulum";
import { ASPEK_LABEL, ASPEK_ORDER, type Aspek } from "@/lib/kurikulum-format";
import { KurikulumTabs } from "../shared";

export const metadata: Metadata = { title: "Pustaka materi · Generus" };

export default function MateriPage({ searchParams }: PageProps<"/kurikulum/materi">) {
  return (
    <>
      <PageHeader
        title="Kurikulum"
        description="Materi yang bisa dipakai ulang di setiap periode: hafalan, dalil, doa, akhlaq, dan lainnya."
        actions={
          <Link href="/kurikulum/materi/baru" className={buttonVariants()}>
            <Plus aria-hidden /> Tambah materi
          </Link>
        }
      />
      <KurikulumTabs active="materi" />
      <Suspense fallback={<p className="text-muted-foreground">Memuat…</p>}>
        <MateriList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function MateriList({ searchParams }: Pick<PageProps<"/kurikulum/materi">, "searchParams">) {
  const [me, sp] = await Promise.all([requireCurriculumEditor(), searchParams]);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const aspek = ASPEK_ORDER.includes(sp.aspek as Aspek) ? (sp.aspek as Aspek) : undefined;
  const archived = sp.arsip === "1";
  const rows = await listMateri(me.claims, { q: q || undefined, aspek, archived });

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const next = { q: q || undefined, aspek, arsip: archived ? "1" : undefined, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    const s = p.toString();
    return `/kurikulum/materi${s ? `?${s}` : ""}`;
  };
  const chip = (label: string, active: boolean, to: string) => (
    <Link
      key={label}
      href={to}
      aria-current={active ? "true" : undefined}
      className={`flex h-9 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
      }`}
    >
      {label}
    </Link>
  );

  const groups = new Map<string, typeof rows>();
  for (const m of rows) {
    const key = `${m.aspek}|${m.mapel}`;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <form role="search" className="flex md:w-80">
          {aspek && <input type="hidden" name="aspek" value={aspek} />}
          {archived && <input type="hidden" name="arsip" value="1" />}
          <label className="flex h-11 w-full items-center gap-2 rounded-full border border-border bg-card px-4 text-muted-foreground md:h-10">
            <Search className="size-[18px] shrink-0" aria-hidden />
            <input
              name="q"
              defaultValue={q}
              placeholder="Cari judul atau mapel"
              aria-label="Cari judul atau mapel"
              className="w-full min-w-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground md:text-[15px]"
            />
          </label>
        </form>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
          {chip("Semua", !aspek, href({ aspek: undefined }))}
          {ASPEK_ORDER.map((a) => chip(ASPEK_LABEL[a], aspek === a, href({ aspek: a })))}
          {chip(archived ? "Arsip ✓" : "Arsip", archived, href({ arsip: archived ? undefined : "1" }))}
        </div>
      </div>

      {rows.length === 0 && (
        <EmptyState
          title={archived ? "Tidak ada materi di arsip" : "Belum ada materi"}
          description={archived ? undefined : "Tambahkan materi, atau buat langsung saat menyusun target periode."}
        />
      )}

      <div className="flex flex-col gap-4">
        {[...groups].map(([key, items]) => (
          <section key={key} className="flex flex-col gap-2">
            <h2 className="px-1 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground">
              {ASPEK_LABEL[items[0].aspek].toUpperCase()} · {items[0].mapel.toUpperCase()}
            </h2>
            <ul className="overflow-hidden rounded-2xl bg-card shadow-card">
              {items.map((m, i) => (
                <li key={m.id} className={i < items.length - 1 ? "border-b border-muted" : ""}>
                  <Link href={`/kurikulum/materi/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40">
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="font-medium">{m.title}</span>
                      <span className="flex flex-wrap gap-1">
                        <Pill tone={m.assessment === "kelompok" ? "muted" : "accent"}>
                          {m.assessment === "kelompok" ? "Per kelompok" : "Per generus"}
                        </Pill>
                        {m.arabic && <Pill tone="muted">Teks Arab</Pill>}
                        {m.usedIn > 0 && <Pill tone="ok">Dipakai {m.usedIn}×</Pill>}
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
