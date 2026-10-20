import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { BackLink, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getAgenda, listAgendaUnits } from "@/lib/agenda";
import { segmentsOf, targetToSegments } from "@/lib/agenda-target";
import { requireGenerusWriter } from "@/lib/auth";
import { listJenjang } from "@/lib/generus";
import { utcToZoned, zoneLabel } from "@/lib/time";
import { updateAgenda } from "../../actions";
import { AgendaForm } from "../../agenda-form";
import { PageLoading } from "@/components/page-loading";

export const metadata: Metadata = { title: "Ubah Agenda · Generus" };

export default function UbahPage({ params }: PageProps<"/agenda/[id]/ubah">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Ubah params={params} />
    </Suspense>
  );
}

async function Ubah({ params }: Pick<PageProps<"/agenda/[id]/ubah">, "params">) {
  const [me, { id }] = await Promise.all([requireGenerusWriter(), params]);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [a, units, jenjang] = await Promise.all([getAgenda(me.claims, id), listAgendaUnits(me.claims), listJenjang(me.claims)]);
  if (!a) notFound();
  if (!a.canManage || a.lockedAt || a.cancelledAt) redirect(`/agenda/${id}`);

  const start = utcToZoned(a.startsAt);
  const DAY = 86_400_000;
  return (
    <>
      <BackLink href={`/agenda/${id}`}>Kembali ke agenda</BackLink>
      <PageHeader title="Ubah agenda" />
      <Card className="max-w-3xl">
        <CardContent>
          <AgendaForm
            action={updateAgenda}
            units={units}
            segments={segmentsOf(jenjang)}
            zone={zoneLabel()}
            allowRepeat={false}
            submitLabel="Simpan perubahan"
            defaults={{
              id: a.id,
              unitId: a.unitId,
              title: a.title,
              location: a.location ?? "",
              date: start.date,
              startTime: start.time,
              endTime: utcToZoned(a.endsAt).time,
              lateMinutes: String(Math.round((a.lateAfter.getTime() - a.startsAt.getTime()) / 60_000)),
              delegateDays: String(Math.max(0, Math.round((a.delegateUntil.getTime() - a.endsAt.getTime()) / DAY))),
              gender: a.targetGender ?? "",
              segments: targetToSegments({ jenjangIds: a.targetJenjangIds, kategoriIds: a.targetKategoriIds }, jenjang),
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
