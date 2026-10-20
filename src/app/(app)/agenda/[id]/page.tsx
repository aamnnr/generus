import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ATTENDANCE_LABEL, ATTENDANCE_STATUSES, getAgenda, getRoster, lockDueAgendas, summarize } from "@/lib/agenda";
import { targetLabel } from "@/lib/agenda-target";
import { requireGenerusReader } from "@/lib/auth";
import { listJenjang } from "@/lib/generus";
import { formatDateLong, formatDateTime, formatTime, zoneLabel } from "@/lib/time";
import { AttendanceChecklist } from "./checklist";
import { CancelForm, LockForm } from "./manage-forms";

export const metadata: Metadata = { title: "Agenda · Generus" };

const LEVEL = { daerah: "Daerah", desa: "Desa", kelompok: "Kelompok" } as const;

const NOTICE: Record<string, string> = {
  dibuat: "Agenda dibuat.",
  diubah: "Agenda diperbarui.",
};

export default function AgendaDetailPage({ params, searchParams }: PageProps<"/agenda/[id]">) {
  return (
    <>
      <Link href="/agenda" className="text-sm text-muted-foreground hover:text-foreground">
        ← Kembali ke agenda
      </Link>
      <Suspense fallback={<p className="text-muted-foreground">Memuat…</p>}>
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
  const roster = await getRoster(me.claims, id);
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
          <h1 className={`text-2xl font-semibold ${a.cancelledAt ? "line-through text-muted-foreground" : ""}`}>{a.title}</h1>
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
        <p className="text-sm text-muted-foreground">Sasaran: {targetLabel({ jenjangIds: a.targetJenjangIds, kategoriIds: a.targetKategoriIds, gender: a.targetGender }, jenjang)}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Peserta" value={sum.total} />
        {ATTENDANCE_STATUSES.map((s) => (
          <Stat key={s} label={ATTENDANCE_LABEL[s]} value={sum.counts[s]} />
        ))}
      </div>
      <p className="-mt-3 text-sm text-muted-foreground">
        Kehadiran {Math.round(sum.rate * 100)}%{sum.counts.belum ? ` · ${sum.counts.belum} belum diisi` : ""}
        {!a.lockedAt && !a.cancelledAt && ` · admin kelompok bisa melengkapi sampai ${formatDateTime(a.delegateUntil)}`}
      </p>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value.toLocaleString("id-ID")}</div>
    </div>
  );
}
