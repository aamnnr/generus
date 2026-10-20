import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { ArrowRight, CalendarDays, ClipboardCheck, IdCard, ScanLine, Users, type LucideIcon } from "lucide-react";
import { generus } from "@/db/schema";
import { withRls } from "@/db/rls";
import { InstallPrompt } from "@/components/install-prompt";
import { initials } from "@/components/shell/nav";
import { EightStar, MosqueSilhouette } from "@/components/shell/ornament";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getBerandaSummary, listMyScanTasks, type HeroAgenda } from "@/lib/agenda";
import { canReadGenerus, canWriteGenerus, getCurrentUser, roleLabel } from "@/lib/auth";
import { isPromotionSeason } from "@/lib/kenaikan-rules";
import { formatDateLong, formatDateTime, formatTime, zoneLabel } from "@/lib/time";

export const metadata: Metadata = { title: "Beranda · Generus" };

export default function BerandaPage({ searchParams }: PageProps<"/beranda">) {
  return (
    <Suspense fallback={<BerandaSkeleton />}>
      <Beranda searchParams={searchParams} />
    </Suspense>
  );
}

const LEVEL = { daerah: "Daerah", desa: "Desa", kelompok: "Kelompok" } as const;

async function Beranda({ searchParams }: Pick<PageProps<"/beranda">, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const reader = canReadGenerus(user);
  const writer = canWriteGenerus(user);
  const [scanTasks, summary, counts] = await Promise.all([
    listMyScanTasks(user.claims),
    reader ? getBerandaSummary(user.claims) : Promise.resolve(null),
    reader
      ? withRls(user.claims, async (tx) => {
          const [row] = await tx
            .select({
              total: sql<number>`count(*)::int`,
              praRemaja: sql<number>`count(*) FILTER (WHERE j.name = 'Pra Remaja')::int`,
              remaja: sql<number>`count(*) FILTER (WHERE j.name = 'Remaja')::int`,
            })
            .from(generus)
            .innerJoin(sql`jenjang j`, sql`j.id = ${generus.jenjangId}`)
            .where(sql`${generus.status} = 'aktif'`);
          return row;
        })
      : Promise.resolve(null),
  ]);
  const hero = summary?.hero ?? null;

  const tiles: { href: string; label: string; icon: LucideIcon }[] = [];
  if (writer || scanTasks.length) {
    const scanHref = hero && hero.ongoing && (hero.canManage || hero.isScanner) ? `/pindai?agenda=${hero.id}` : scanTasks[0] ? `/pindai?agenda=${scanTasks[0].id}` : "/agenda";
    tiles.push({ href: scanHref, label: "Scan QR", icon: ScanLine });
  }
  if (reader) tiles.push({ href: hero ? `/agenda/${hero.id}` : "/agenda", label: "Presensi", icon: ClipboardCheck }, { href: "/generus", label: "Generus", icon: Users });
  if (writer) tiles.push({ href: "/generus/kartu", label: "Kartu QR", icon: IdCard });
  else if (reader) tiles.push({ href: "/agenda", label: "Agenda", icon: CalendarDays });

  return (
    <>
      {params.status === "password-diganti" && (
        <Alert>
          <AlertDescription>Password berhasil diganti.</AlertDescription>
        </Alert>
      )}

      <header className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] font-medium text-muted-foreground">Assalamu&apos;alaikum,</span>
          <h1 className="font-heading text-[28px] leading-[34px] font-semibold lg:text-[32px] lg:leading-10">{user.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {user.roles.length === 0 && <span className="text-sm text-muted-foreground">Belum punya peran.</span>}
            {user.roles.map((r) => (
              <span key={`${r.role}-${r.unitId}`} className="rounded-full bg-secondary px-3 py-1 text-[13px] font-semibold text-secondary-foreground">
                {roleLabel(r)} · {r.unitName}
              </span>
            ))}
          </div>
        </div>
        <Link
          href="/lainnya"
          aria-label="Akun saya"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-bold text-secondary-foreground lg:hidden"
        >
          {initials(user.name)}
        </Link>
      </header>

      {writer && isPromotionSeason(new Date()) && (
        <Alert>
          <AlertDescription>
            Awal tahun ajaran: periksa generus yang lulus SLTP atau selesai sekolah di{" "}
            <Link href="/generus/kenaikan" className="font-semibold underline">
              Kenaikan jenjang
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}

      {scanTasks.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-card md:p-5">
          <div>
            <h2 className="text-lg font-bold">Tugas scan</h2>
            <p className="text-sm text-muted-foreground">Anda ditunjuk sebagai petugas pemindai QR.</p>
          </div>
          <ul className="flex flex-col gap-2">
            {scanTasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{t.title}</span>
                  <span className="block text-[13px] text-muted-foreground">
                    {t.unitName} · {formatDateTime(t.startsAt)}
                  </span>
                </span>
                <Link href={`/pindai?agenda=${t.id}`} className="flex h-11 items-center gap-2 rounded-full bg-primary px-4 font-semibold text-primary-foreground">
                  <ScanLine className="size-5" aria-hidden /> Buka pemindai
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        {reader && (
          <div className="order-1 lg:col-span-8">
            <HeroCard hero={hero} writer={writer} />
          </div>
        )}
          {summary && (
            <section className="order-3 flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-card lg:order-2 lg:col-span-4">
              <div className="flex items-center">
                <h2 className="flex-1 text-lg font-bold">
                  {new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                </h2>
                <Link href="/agenda?tab=selesai" className="text-sm font-semibold text-primary">
                  Lihat agenda
                </Link>
              </div>
              <Progress
                label="Kehadiran"
                value={summary.month.rate}
                hint={`${summary.month.locked} dari ${summary.month.agendas} agenda sudah dikunci`}
              />
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Agenda bulan ini</dt>
                  <dd className="font-semibold tabular-nums">{summary.month.agendas}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Alpa 3× berturut-turut</dt>
                  <dd className={`font-semibold tabular-nums ${summary.month.alpaStreak ? "text-destructive" : ""}`}>
                    {summary.month.alpaStreak} generus
                  </dd>
                </div>
              </dl>
            </section>
          )}
          {tiles.length > 0 && (
            <nav aria-label="Aksi cepat" className="order-2 grid grid-cols-4 gap-2 md:gap-3 lg:order-3 lg:col-span-12">
              {tiles.map((t) => (
                <Link
                  key={t.label}
                  href={t.href}
                  className="flex flex-col items-center gap-1.5 rounded-2xl py-1 text-center md:bg-card md:py-4 md:shadow-card"
                >
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-tile text-primary md:size-12">
                    <t.icon className="size-6" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="text-[13px] font-medium md:text-sm md:font-semibold">{t.label}</span>
                </Link>
              ))}
            </nav>
          )}
      </div>


      {counts && (
        <div className="grid grid-cols-3 gap-3">
          <Stat title="Generus aktif" value={counts.total} />
          <Stat title="Pra Remaja" value={counts.praRemaja} />
          <Stat title="Remaja" value={counts.remaja} />
        </div>
      )}

      <InstallPrompt />

      {writer && (
        <div className="flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3.5 text-secondary-foreground">
          <EightStar className="size-7 shrink-0" />
          <p className="text-[13px] leading-5">
            Kartu QR dipakai pada pengajian desa & daerah. Kartu hilang? Terbitkan ulang dari halaman generus lalu cetak.
          </p>
        </div>
      )}
    </>
  );
}

function HeroCard({ hero, writer }: { hero: HeroAgenda | null; writer: boolean }) {
  if (!hero) {
    return (
      <section className="relative flex h-full flex-col justify-center gap-3 overflow-hidden rounded-[20px] bg-hero p-5 text-hero-foreground shadow-float md:p-7">
        <MosqueSilhouette className="absolute -right-3 bottom-0 w-56 opacity-10" />
        <span className="text-[11px] font-semibold tracking-[0.06em] text-white/80">AGENDA</span>
        <p className="text-lg font-bold">Belum ada agenda mendatang.</p>
        {writer && (
          <Link href="/agenda/baru" className="flex h-11 w-fit items-center gap-2 rounded-full bg-white px-5 font-bold text-hero">
            Buat agenda <ArrowRight className="size-[18px]" aria-hidden />
          </Link>
        )}
      </section>
    );
  }
  const pct = hero.targets ? Math.round((hero.present / hero.targets) * 100) : 0;
  const scan = hero.ongoing && (hero.canManage || hero.isScanner);
  return (
    <section className="relative flex h-full flex-col gap-3 overflow-hidden rounded-[20px] bg-hero p-5 text-hero-foreground shadow-float md:p-7">
      <MosqueSilhouette className="absolute -right-4 top-2 w-48 opacity-[0.12] md:w-64" />
      <div className="flex items-center gap-2">
        {hero.ongoing && <span className="size-2 rounded-full bg-[oklch(0.82_0.09_158)]" aria-hidden />}
        <span className="text-[11px] font-semibold tracking-[0.06em] text-white/80">
          {hero.ongoing ? "SEDANG BERLANGSUNG" : "AGENDA BERIKUTNYA"} · {LEVEL[hero.level].toUpperCase()}
        </span>
      </div>
      <div>
        <p className="text-lg leading-[26px] font-bold md:text-[22px] md:leading-[30px]">{hero.title}</p>
        <p className="text-[13px] text-white/80 md:text-sm">
          {formatDateLong(hero.startsAt)} · {formatTime(hero.startsAt)}–{formatTime(hero.endsAt)} {zoneLabel()}
          {hero.location ? ` · ${hero.location}` : ""}
        </p>
      </div>
      {hero.ongoing ? (
        <>
          <p className="flex items-baseline gap-2">
            <span className="font-heading text-[34px] leading-10 font-semibold tabular-nums">{hero.present.toLocaleString("id-ID")}</span>
            <span className="text-white/80">/ {hero.targets.toLocaleString("id-ID")} tercatat hadir</span>
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Kehadiran">
            <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
          </div>
        </>
      ) : (
        <p className="flex items-baseline gap-2">
          <span className="font-heading text-[34px] leading-10 font-semibold tabular-nums">{hero.targets.toLocaleString("id-ID")}</span>
          <span className="text-white/80">peserta sasaran</span>
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <Link href={`/agenda/${hero.id}`} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white px-5 font-bold text-hero sm:flex-none">
          {hero.ongoing ? "Buka presensi" : "Lihat agenda"} <ArrowRight className="size-[18px]" aria-hidden />
        </Link>
        {scan && (
          <Link href={`/pindai?agenda=${hero.id}`} className="flex h-11 items-center gap-2 rounded-full border border-white/50 px-4 font-semibold">
            <ScanLine className="size-[18px]" aria-hidden /> Scan QR
          </Link>
        )}
      </div>
    </section>
  );
}

function Progress({ label, value, hint }: { label: string; value: number | null; hint: string }) {
  const pct = value === null ? null : Math.round(value * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex justify-between font-semibold">
        <span>{label}</span>
        <span className="tabular-nums">{pct === null ? "—" : `${pct}%`}</span>
      </span>
      <span className="h-2 overflow-hidden rounded-full bg-[oklch(0.879_0.027_159.5)]">
        <span className="block h-full rounded-full bg-[oklch(0.488_0.079_164.3)]" style={{ width: `${pct ?? 0}%` }} />
      </span>
      <span className="text-[13px] text-muted-foreground">{hint}</span>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-card md:p-5">
      <div className="text-xs text-muted-foreground md:text-[13px]">{title}</div>
      <div className="font-heading text-2xl font-semibold tabular-nums md:text-[30px] md:leading-[38px]">{value.toLocaleString("id-ID")}</div>
    </div>
  );
}

function BerandaSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Memuat beranda">
      <div className="h-16 w-2/3 animate-pulse rounded-xl bg-muted" />
      <div className="h-52 animate-pulse rounded-[20px] bg-muted" />
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

