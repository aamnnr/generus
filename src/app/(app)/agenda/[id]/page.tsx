import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "@/components/app-link";
import { BackLink } from "@/components/page-header";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScanLine } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ATTENDANCE_LABEL, ATTENDANCE_STATUSES, getAgenda, getRoster, listScannerCandidates, listScanners, lockDueAgendas, summarize } from "@/lib/agenda";
import { targetLabel } from "@/lib/agenda-target";
import { requireGenerusReader } from "@/lib/auth";
import { listJenjang } from "@/lib/generus";
import { formatDateLong, formatDateTime, formatTime, zoneLabel } from "@/lib/time";
import { AttendanceChecklist } from "./checklist";
import { removeScanner } from "../actions";
import { AddScannerForm, CancelForm, LockForm } from "./manage-forms";
import { PageLoading } from "@/components/page-loading";

export const metadata: Metadata = { title: "Agenda · Generus" };

const LEVEL = { daerah: "Daerah", desa: "Desa", kelompok: "Kelompok" } as const;

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
  const [roster, scanners, candidates] = await Promise.all([
    getRoster(me.claims, id),
    a.canManage ? listScanners(me.claims, id) : Promise.resolve([]),
    a.canManage ? listScannerCandidates(me.claims) : Promise.resolve([]),
  ]);
  const scanOpen = !a.lockedAt && !a.cancelledAt && (a.canManage || a.isScanner);
  const sum = summarize(roster);
  const now = new Date();
  const started = now >= a.startsAt;
  const ended = now >= a.endsAt;
  const pesan = typeof sp.pesan === "string" ? sp.pesan : "";
  const notice = NOTICE[pesan] ?? (pesan.startsWith("dibuat-") ? `${pesan.slice(7)} agenda mingguan dibuat.` : null);
  const showGroup = new Set(roster.map((r) => r.kelompok + r.desa)).size > 1;

  // Rekap per kelompok untuk agenda desa/daerah.
  const perKelompok = new Map<string, ReturnType<typeof summarize>>();
  if (showGroup) {
    const groups = new Map<string, typeof roster>();
    for (const r of roster) groups.set(`${r.kelompok} · ${r.desa}`, [...(groups.get(`${r.kelompok} · ${r.desa}`) ?? []), r]);
    for (const [k, rows] of groups) perKelompok.set(k, summarize(rows));
  }

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
      <p className="-mt-3 text-sm text-muted-foreground">
        Kehadiran {Math.round(sum.rate * 100)}%{sum.counts.belum ? ` · ${sum.counts.belum} belum diisi` : ""}
        {!a.lockedAt && !a.cancelledAt && ` · admin kelompok bisa melengkapi sampai ${formatDateTime(a.delegateUntil)}`}
      </p>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* HP: tanpa kartu luar agar baris checklist selebar layar (DESIGN.md §6.4). */}
        <Card className="max-md:overflow-visible max-md:bg-transparent max-md:shadow-none max-md:[--card-spacing:0px]">
          <CardHeader>
            <CardTitle>Presensi</CardTitle>
            <CardDescription>
              {a.cancelledAt
                ? "Agenda dibatalkan."
                : !started
                  ? "Agenda belum dimulai. Izin/sakit sudah bisa dicatat."
                  : roster.some((r) => r.canWrite)
                    ? "Ketuk status untuk setiap peserta; tersimpan otomatis."
                    : "Anda hanya bisa melihat presensi agenda ini."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {roster.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada peserta sasaran yang terlihat oleh Anda.</p>
            ) : (
              <AttendanceChecklist
                agendaId={a.id}
                showGroup={showGroup}
                rows={roster.map((r) => ({ ...r, canWrite: r.canWrite && !a.cancelledAt }))}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {perKelompok.size > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Per kelompok</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm">
                  {[...perKelompok].map(([k, s]) => (
                    <li key={k} className="flex items-center justify-between gap-2">
                      <span>{k}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {s.counts.hadir + s.counts.terlambat}/{s.total} ({Math.round(s.rate * 100)}%)
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

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

function Stat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`rounded-2xl px-3 py-2 md:px-4 md:py-3 ${className}`}>
      <div className="text-xs font-semibold">{label}</div>
      <div className="font-heading text-xl font-semibold tabular-nums md:text-[26px] md:leading-8">{value.toLocaleString("id-ID")}</div>
    </div>
  );
}
