import { Pill } from "@/components/page-header";
import { formatRange, juzLabel } from "@/lib/kurikulum-format";
import type { PeriodListItem, TargetRow } from "@/lib/kurikulum";

const fmt = (iso: string, withYear: boolean) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });

/** "5 Okt – 7 Nov 2026" */
export function dateRange(startsOn: string, endsOn: string): string {
  const sameYear = startsOn.slice(0, 4) === endsOn.slice(0, 4);
  return `${fmt(startsOn, !sameYear)} – ${fmt(endsOn, true)}`;
}

/** Tanggal hari ini (zona aplikasi) sebagai YYYY-MM-DD. */
export function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Jakarta" });
}

export function PeriodPills({ p, today }: { p: PeriodListItem; today: string }) {
  return (
    <>
      {!p.publishedAt && <Pill tone="muted">Draf</Pill>}
      {p.publishedAt && p.startsOn <= today && today <= p.endsOn && <Pill tone="ok">Berlangsung</Pill>}
    </>
  );
}

const GENDER = { L: "Putra", P: "Putri" } as const;

/** Isi satu target: judul/rentang kitab, uraian, teks Arab, terjemahan, dan label sasaran. */
export function TargetContent({ t }: { t: TargetRow }) {
  const m = t.materi;
  const k = t.kitab;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold">
          {k ? (
            <>
              {k.title}
              {t.note && <span className="font-normal text-muted-foreground"> · {t.note}</span>}
            </>
          ) : (
            m?.title
          )}
        </span>
        {t.gender && <Pill>{GENDER[t.gender]}</Pill>}
        {t.kategoriName && <Pill>{t.kategoriName}</Pill>}
        {t.optional && <Pill tone="muted">Pilihan</Pill>}
        {m?.assessment === "kelompok" && <Pill tone="muted">Per kelompok</Pill>}
      </div>
      {k && (
        <p className="text-sm">
          {formatRange(k.unit, k.from, k.to)}
          {k.unit === "ayat" && !t.note && <span className="text-muted-foreground"> · {juzLabel(k.from, k.to)}</span>}
        </p>
      )}
      {m?.body && <p className="text-sm whitespace-pre-line text-muted-foreground">{m.body}</p>}
      {m?.arabic && (
        <p lang="ar" dir="rtl" className="font-arabic text-xl leading-[2.1] whitespace-pre-line">
          {m.arabic}
        </p>
      )}
      {(m?.translation || m?.source) && (
        <p className="text-sm text-muted-foreground">
          {m.translation && <span className="italic">&ldquo;{m.translation}&rdquo;</span>}
          {m.source && <span className="font-semibold"> ({m.source})</span>}
        </p>
      )}
    </div>
  );
}
