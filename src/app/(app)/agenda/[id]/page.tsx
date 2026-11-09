import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "@/components/app-link";
import { BackLink } from "@/components/page-header";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, ScanLine, Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ATTENDANCE_LABEL,
  ATTENDANCE_STATUSES,
  getAgenda,
  getAgendaSummary,
  getRoster,
  listScannerCandidates,
  listScanners,
  lockDueAgendas,
  sumSummaries,
  type AttendanceSummary,
  type KelompokSummary,
  type RosterRow,
} from "@/lib/agenda";
import { targetLabel } from "@/lib/agenda-target";
import { requireGenerusReader } from "@/lib/auth";
import { listJenjang } from "@/lib/generus";
import { formatDateLong, formatDateTime, formatTime, zoneLabel } from "@/lib/time";
import { AttendanceChecklist } from "./checklist";
import { removeScanner } from "../actions";
import { AddScannerForm, CancelForm, LockForm } from "./manage-forms";
import { PageLoading } from "@/components/page-loading";
import { QueryForm } from "@/components/query-form";
import { Input } from "@/components/ui/input";
import { LiveRefresh } from "./live-refresh";

export const metadata: Metadata = { title: "Agenda · Generus" };

const LEVEL = { daerah: "Daerah", desa: "Desa", kelompok: "Kelompok" } as const;
const SEARCH_LIMIT = 50;

const NOTICE: Record<string, string> = {
  dibuat: "Agenda dibuat.",
  diubah: "Agenda diperbarui.",
};

export default function AgendaDetailPage({ params, searchParams }: PageProps<"/agenda/[id]">) {
  return (
    <>
      <BackLink href="/agenda">Kembali ke agenda</BackLink>
      <Suspense fallback={<PageLoading />}>
        <Detail params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Detail({ params, searchParams }: Pick<PageProps<"/agenda/[id]">, "params" | "searchParams">) {
  const [me, { id }, sp] = await Promise.all([requireGenerusReader(), params, searchParams]);
  if (!z.string().uuid().safeParse(id).success) notFound();
  await lockDueAgendas(me.claims);
  const [a, jenjang] = await Promise.all([getAgenda(me.claims, id), listJenjang(me.claims)]);
  if (!a) notFound();
  // Tampilan awal agenda besar = ringkasan per kelompok (dihitung di database).
  // Daftar nama baru dimuat untuk satu kelompok yang dipilih atau hasil pencarian,
  // agar halaman ringan meski pesertanya ribuan.
  const summary = await getAgendaSummary(me.claims, id);
  const single = summary.length <= 1;
  const kelompokParam = typeof sp.kelompok === "string" ? sp.kelompok : "";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const selected = single ? summary[0] : summary.find((k) => k.kelompokId === kelompokParam);
  const [roster, scanners, candidates] = await Promise.all([
    selected
      ? getRoster(me.claims, id, { kelompokId: selected.kelompokId })
      : q.length >= 2
        ? getRoster(me.claims, id, { q, limit: SEARCH_LIMIT })
        : Promise.resolve(null),
    a.canManage ? listScanners(me.claims, id) : Promise.resolve([]),
    a.canManage ? listScannerCandidates(me.claims) : Promise.resolve([]),
  ]);
  const scanOpen = !a.lockedAt && !a.cancelledAt && (a.canManage || a.isScanner);
  const sum = sumSummaries(summary);
  const now = new Date();
  const started = now >= a.startsAt;
  const ended = now >= a.endsAt;
  // Perbarui otomatis sejak 1 jam sebelum mulai sampai batas pelengkapan.
  const live = !a.lockedAt && !a.cancelledAt && now.getTime() >= a.startsAt.getTime() - 3600_000 && now <= a.delegateUntil;
  const pesan = typeof sp.pesan === "string" ? sp.pesan : "";
  const notice = NOTICE[pesan] ?? (pesan.startsWith("dibuat-") ? `${pesan.slice(7)} agenda mingguan dibuat.` : null);
  const base = `/agenda/${a.id}`;
  const view: "list" | "search" | "summary" = selected ? "list" : roster ? "search" : "summary";

  return (
    <>
      {notice && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className={`text-2xl font-bold md:text-[26px] ${a.cancelledAt ? "line-through text-muted-foreground" : ""}`}>{a.title}</h1>
          <Badge variant="outline">
            {LEVEL[a.level]} {a.unitName}
          </Badge>
          {a.cancelledAt && <Badge variant="destructive">Dibatalkan</Badge>}
          {a.lockedAt && <Badge variant="secondary">Presensi terkunci</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDateLong(a.startsAt)} · {formatTime(a.startsAt)}–{formatTime(a.endsAt)} {zoneLabel()}
          {a.location ? ` · ${a.location}` : ""}
        </p>
        {scanOpen && (
          <Link href={`/pindai?agenda=${a.id}`} className={`${buttonVariants({ size: "lg" })} mt-2 w-full sm:w-fit`}>
            <ScanLine aria-hidden /> Buka pemindai QR
          </Link>
        )}
        <p className="text-sm text-muted-foreground">Sasaran: {targetLabel({ jenjangIds: a.targetJenjangIds, kategoriIds: a.targetKategoriIds, gender: a.targetGender }, jenjang)}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 md:gap-3">
        <Stat label="Peserta" value={sum.total} className="bg-card text-foreground shadow-card" />
        {ATTENDANCE_STATUSES.map((s) => (
          <Stat key={s} label={ATTENDANCE_LABEL[s]} value={sum.counts[s]} className={STAT_TONE[s]} />
        ))}
      </div>
      <div className="-mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>
          Kehadiran {Math.round(sum.rate * 100)}%{sum.counts.belum ? ` · ${sum.counts.belum.toLocaleString("id-ID")} belum diisi` : ""}
          {!a.lockedAt && !a.cancelledAt && ` · admin di bawahnya bisa melengkapi anggotanya sampai ${formatDateTime(a.delegateUntil)}`}
        </span>
        {live && <LiveRefresh />}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* HP: tanpa kartu luar agar baris checklist selebar layar (DESIGN.md §6.4). */}
        <Card className="max-md:overflow-visible max-md:bg-transparent max-md:shadow-none max-md:[--card-spacing:0px]">
          <CardHeader>
            {view !== "summary" && !single && (
              <Link href={base} scroll={false} className="tap mb-1 inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground hover:text-foreground">
                <ChevronLeft className="size-4" aria-hidden /> Semua kelompok
              </Link>
            )}
            <CardTitle>
              {view === "list" && !single && selected
                ? `${selected.kelompok} · Desa ${selected.desa}`
                : view === "search"
                  ? `Hasil pencarian “${q}”`
                  : "Presensi"}
            </CardTitle>
            <CardDescription>
              {a.cancelledAt
                ? "Agenda dibatalkan."
                : view === "summary"
                  ? "Hasil pemindai QR masuk otomatis. Pilih kelompok atau cari nama untuk melihat daftar dan mengisi presensi manual."
                  : !started
                    ? "Agenda belum dimulai. Izin/sakit sudah bisa dicatat."
                    : roster?.some((r) => r.canWrite)
                      ? "Ketuk status untuk setiap peserta; tersimpan otomatis."
                      : "Anda hanya bisa melihat presensi ini."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Di daftar satu kelompok cukup pencarian di checklist; pencarian lintas kelompok di ringkasan. */}
            {!single && view !== "list" && (
              <QueryForm action={base} className="flex gap-2" role="search">
                <Input
                  name="q"
                  defaultValue={view === "search" ? q : ""}
                  minLength={2}
                  placeholder="Cari nama di semua kelompok"
                  aria-label="Cari nama peserta"
                  className="max-w-sm rounded-full"
                />
                <Button type="submit" variant="outline" className="rounded-full">
                  <Search aria-hidden /> Cari
                </Button>
              </QueryForm>
            )}
            {view === "summary" ? (
              summary.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada peserta sasaran yang terlihat oleh Anda.</p>
              ) : (
                <SummaryTable summary={summary} base={base} />
              )
            ) : (
              <RosterView rows={roster ?? []} agendaId={a.id} cancelled={!!a.cancelledAt} group={view === "search"} summary={selected} single={single} />
            )}
            {view === "search" && roster && roster.length >= SEARCH_LIMIT && (
              <p className="text-xs text-muted-foreground">Menampilkan {SEARCH_LIMIT} hasil pertama. Perjelas nama yang dicari, atau buka per kelompok.</p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {a.canManage && scanOpen && (
            <Card>
              <CardHeader>
                <CardTitle>Petugas scan</CardTitle>
                <CardDescription>Akses pemindai sementara untuk agenda ini, sampai {formatDateTime(a.delegateUntil)}.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {scanners.length === 0 && <p className="text-sm text-muted-foreground">Belum ada petugas. Pengelola agenda selalu bisa memindai.</p>}
                <ul className="flex flex-col gap-1 text-sm">
                  {scanners.map((s) => (
                    <li key={s.userId} className="flex items-center justify-between gap-2">
                      <span className={s.expiresAt < now ? "text-muted-foreground line-through" : ""}>{s.name}</span>
                      <form action={removeScanner}>
                        <input type="hidden" name="agendaId" value={a.id} />
                        <input type="hidden" name="userId" value={s.userId} />
                        <Button type="submit" variant="ghost" size="xs">
                          Cabut
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
                <AddScannerForm agendaId={a.id} candidates={candidates.filter((c) => !scanners.some((s) => s.userId === c.id))} />
              </CardContent>
            </Card>
          )}

          {a.canManage && !a.cancelledAt && (
            <Card>
              <CardHeader>
                <CardTitle>Kelola agenda</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {!a.lockedAt && (
                  <Link href={`/agenda/${a.id}/ubah`} className={buttonVariants({ variant: "outline", size: "sm" }) + " w-fit"}>
                    Ubah agenda
                  </Link>
                )}
                {ended && !a.lockedAt && <LockForm id={a.id} />}
                {!a.lockedAt && <CancelForm id={a.id} recurring={!!a.recurrenceId} />}
                {a.lockedAt && (
                  <p className="text-sm text-muted-foreground">
                    Dikunci {formatDateTime(a.lockedAt)}. Anda masih bisa mengoreksi presensi; setiap perubahan tercatat.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

const STAT_TONE: Record<(typeof ATTENDANCE_STATUSES)[number], string> = {
  hadir: "bg-status-hadir-soft text-status-hadir",
  terlambat: "bg-status-terlambat-soft text-status-terlambat",
  izin: "bg-status-izin-soft text-status-izin",
  sakit: "bg-status-sakit-soft text-status-sakit",
  alpa: "bg-status-alpa-soft text-status-alpa",
};

/** Rekap per kelompok, dikelompokkan per desa bila lebih dari satu desa. Setiap baris membuka daftar kelompok itu. */
function SummaryTable({ summary, base }: { summary: KelompokSummary[]; base: string }) {
  const desa = new Map<string, KelompokSummary[]>();
  for (const k of summary) desa.set(k.desaId, [...(desa.get(k.desaId) ?? []), k]);
  const multiDesa = desa.size > 1;
  return (
    <div className="flex flex-col gap-4">
      {[...desa.values()].map((items) => {
        const total = sumSummaries(items);
        return (
          <section key={items[0].desaId} className="flex flex-col gap-1">
            {multiDesa && (
              <div className="flex items-baseline justify-between gap-2 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <span>Desa {items[0].desa}</span>
                <span className="tabular-nums normal-case">
                  {(total.counts.hadir + total.counts.terlambat).toLocaleString("id-ID")}/{total.total.toLocaleString("id-ID")} · {Math.round(total.rate * 100)}%
                </span>
              </div>
            )}
            <ul className="flex flex-col divide-y divide-muted rounded-2xl bg-card shadow-card">
              {items.map((k) => (
                <li key={k.kelompokId}>
                  <Link
                    href={`${base}?kelompok=${k.kelompokId}`}
                    scroll={false}
                    className="tap-row flex items-center gap-3 px-3 py-3 first:rounded-t-2xl last:rounded-b-2xl md:px-4"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{k.kelompok}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {(k.counts.hadir + k.counts.terlambat).toLocaleString("id-ID")}/{k.total.toLocaleString("id-ID")} · {Math.round(k.rate * 100)}%
                        </span>
                      </span>
                      <ProgressBar s={k} />
                      {k.counts.belum > 0 && <span className="text-xs text-muted-foreground">{k.counts.belum} belum diisi</span>}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

const BAR_TONE: Record<(typeof ATTENDANCE_STATUSES)[number], string> = {
  hadir: "bg-status-hadir",
  terlambat: "bg-status-terlambat",
  izin: "bg-status-izin",
  sakit: "bg-status-sakit",
  alpa: "bg-status-alpa",
};

/** Batang komposisi status; sisa (abu-abu) = belum diisi. */
function ProgressBar({ s }: { s: AttendanceSummary }) {
  const label = ATTENDANCE_STATUSES.map((st) => `${ATTENDANCE_LABEL[st]} ${s.counts[st]}`).join(", ") + `, belum ${s.counts.belum}`;
  return (
    <span className="flex h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={label}>
      {s.total > 0 &&
        ATTENDANCE_STATUSES.map((st) =>
          s.counts[st] ? <span key={st} className={BAR_TONE[st]} style={{ width: `${(s.counts[st] / s.total) * 100}%` }} /> : null,
        )}
    </span>
  );
}

function RosterView({
  rows,
  agendaId,
  cancelled,
  group,
  summary,
  single,
}: {
  rows: RosterRow[];
  agendaId: string;
  cancelled: boolean;
  group: boolean;
  summary?: KelompokSummary;
  single: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{group ? "Tidak ada peserta dengan nama itu." : "Tidak ada peserta sasaran yang terlihat oleh Anda."}</p>;
  }
  return (
    <>
      {summary && !single && (
        <div className="flex flex-col gap-1.5">
          <ProgressBar s={summary} />
          <span className="text-xs text-muted-foreground tabular-nums">
            {ATTENDANCE_STATUSES.map((st) => `${ATTENDANCE_LABEL[st]} ${summary.counts[st]}`).join(" · ")} · Belum {summary.counts.belum}
          </span>
        </div>
      )}
      <AttendanceChecklist agendaId={agendaId} showGroup={group} rows={rows.map((r) => ({ ...r, canWrite: r.canWrite && !cancelled }))} />
    </>
  );
}

function Stat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`rounded-2xl px-3 py-2 md:px-4 md:py-3 ${className}`}>
      <div className="text-xs font-semibold">{label}</div>
      <div className="font-heading text-xl font-semibold tabular-nums md:text-[26px] md:leading-8">{value.toLocaleString("id-ID")}</div>
    </div>
  );
}
