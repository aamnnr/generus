import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BackLink, PageHeader, Pill } from "@/components/page-header";
import { initials } from "@/components/shell/nav";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ATTENDANCE_LABEL, getGenerusAttendance } from "@/lib/agenda";
import { canMutateGenerus, canWriteGenerus, requireGenerusReader } from "@/lib/auth";
import {
  ageOn,
  formatDate,
  getGenerus,
  jenjangLabel,
  listJenjang,
  listScopeUnits,
  STATUS_LABEL,
  type GenerusDetail,
} from "@/lib/generus";
import { updateGenerus } from "../actions";
import { GenerusForm } from "../generus-form";
import { formatDateTime } from "@/lib/time";
import { DeleteForm, MutateForm, ReactivateForm, ReissueCardForm, StatusForm } from "./forms";

export const metadata: Metadata = { title: "Detail Generus · Generus" };

export default function DetailPage({ params, searchParams }: PageProps<"/generus/[id]">) {
  return (
    <>
      <BackLink href="/generus">Kembali ke daftar generus</BackLink>
      <Suspense fallback={<p className="text-muted-foreground">Memuat…</p>}>
        <Detail params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Detail({ params, searchParams }: Pick<PageProps<"/generus/[id]">, "params" | "searchParams">) {
  const [me, { id }, sp] = await Promise.all([requireGenerusReader(), params, searchParams]);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const g = await getGenerus(me.claims, id);
  if (!g) notFound();

  const writer = canWriteGenerus(me);
  const mutator = canMutateGenerus(me);
  const [jenjang, mutateTargets, kehadiran] = await Promise.all([
    writer ? listJenjang(me.claims) : Promise.resolve([]),
    mutator && g.status === "aktif" ? listScopeUnits(me.claims, "mutate") : Promise.resolve([]),
    getGenerusAttendance(me.claims, g.id, 10),
  ]);

  return (
    <>
      {sp.pesan === "dibuat" && (
        <Alert>
          <AlertDescription>Generus ditambahkan.</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-bold text-secondary-foreground md:size-16">
          {initials(g.name)}
        </span>
        <PageHeader
          title={g.name}
          badges={<Pill tone={g.status === "aktif" ? "ok" : "muted"}>{STATUS_LABEL[g.status]}</Pill>}
          description={`${jenjangLabel(g.jenjang, g.kategori)} · ${ageOn(g.birthDate)} tahun · Kelompok ${g.kelompok}, Desa ${g.desa}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Data diri</CardTitle>
          </CardHeader>
          <CardContent>
            {writer ? (
              <GenerusForm
                action={updateGenerus}
                defaults={{
                  id: g.id,
                  name: g.name,
                  gender: g.gender,
                  birthDate: g.birthDate,
                  jenjangId: g.jenjangId,
                  kategoriId: g.kategoriId,
                  school: g.school,
                  guardianName: g.guardianName,
                  guardianPhone: g.guardianPhone,
                  notes: g.notes,
                }}
                jenjang={jenjang}
                submitLabel="Simpan perubahan"
              />
            ) : (
              <ReadOnly g={g} />
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Kehadiran</CardTitle>
              <CardDescription>
                {kehadiran.stats.total > 0
                  ? `${Math.round((kehadiran.stats.hadir / kehadiran.stats.total) * 100)}% hadir dari ${kehadiran.stats.total} agenda yang sudah dikunci · ${kehadiran.stats.alpa} alpa`
                  : "Belum ada agenda yang dikunci."}
              </CardDescription>
            </CardHeader>
            {kehadiran.rows.length > 0 && (
              <CardContent>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {kehadiran.rows.map((r) => (
                    <li key={r.agendaId} className="flex items-center justify-between gap-2">
                      <Link href={`/agenda/${r.agendaId}`} className="min-w-0 truncate hover:underline">
                        <span className="text-muted-foreground">{formatDateTime(r.startsAt)}</span> · {r.title}
                      </Link>
                      <Badge variant={r.status === "alpa" ? "destructive" : r.status === "hadir" ? "secondary" : "outline"}>
                        {ATTENDANCE_LABEL[r.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>

          {writer && (
            <Card>
              <CardHeader>
                <CardTitle>Status keanggotaan</CardTitle>
                <CardDescription>
                  {g.status === "aktif"
                    ? "Tandai bila generus menikah atau pindah ke luar daerah."
                    : `${STATUS_LABEL[g.status]} sejak ${g.statusDate ? formatDate(g.statusDate) : "-"}${g.statusNote ? ` — ${g.statusNote}` : ""}.`}
                </CardDescription>
              </CardHeader>
              <CardContent>{g.status === "aktif" ? <StatusForm id={g.id} /> : <ReactivateForm id={g.id} />}</CardContent>
            </Card>
          )}

          {writer && g.status === "aktif" && (
            <Card>
              <CardHeader>
                <CardTitle>Kartu QR</CardTitle>
                <CardDescription>Dipakai untuk presensi scan di pengajian desa/daerah.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Link href={`/generus/kartu?id=${g.id}`} className={`${buttonVariants({ variant: "outline", size: "sm" })} w-fit`}>
                  Cetak kartu
                </Link>
                <ReissueCardForm id={g.id} />
              </CardContent>
            </Card>
          )}

          {mutator && g.status === "aktif" && (
            <Card>
              <CardHeader>
                <CardTitle>Pindah kelompok</CardTitle>
                <CardDescription>Mutasi di dalam daerah. Riwayat kehadiran tetap tersimpan.</CardDescription>
              </CardHeader>
              <CardContent>
                <MutateForm id={g.id} options={mutateTargets} currentKelompokId={g.kelompokId} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Riwayat</CardTitle>
            </CardHeader>
            <CardContent>
              {g.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada perubahan status atau kelompok.</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {g.history.map((h, i) => (
                    <li key={i}>
                      <span className="text-muted-foreground">
                        {h.at.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </span>{" "}
                      — {h.text}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {writer && (
            <Card>
              <CardHeader>
                <CardTitle>Hapus data</CardTitle>
                <CardDescription>
                  Hanya untuk data yang salah input. Untuk generus yang menikah atau pindah, ubah statusnya.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DeleteForm id={g.id} name={g.name} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function ReadOnly({ g }: { g: GenerusDetail }) {
  const rows: [string, string | null][] = [
    ["Jenis kelamin", g.gender === "L" ? "Laki-laki" : "Perempuan"],
    ["Tanggal lahir", formatDate(g.birthDate)],
    ["Jenjang", jenjangLabel(g.jenjang, g.kategori)],
    ["Sekolah / kelas", g.school],
    ["Orang tua/wali", g.guardianName],
    ["No. HP orang tua/wali", g.guardianPhone],
    ["Catatan", g.notes],
  ];
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-[auto_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd>{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
