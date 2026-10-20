import { Suspense } from "react";
import type { Metadata } from "next";
import { BackLink, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { listAgendaUnits } from "@/lib/agenda";
import { segmentsOf } from "@/lib/agenda-target";
import { requireGenerusWriter } from "@/lib/auth";
import { listJenjang } from "@/lib/generus";
import { utcToZoned, zoneLabel } from "@/lib/time";
import { createAgenda } from "../actions";
import { AgendaForm } from "../agenda-form";

export const metadata: Metadata = { title: "Buat Agenda · Generus" };

export default function BaruPage() {
  return (
    <>
      <BackLink href="/agenda">Kembali ke agenda</BackLink>
      <PageHeader title="Buat agenda" />
      <Card className="max-w-3xl">
        <CardContent>
          <Suspense fallback={<p className="text-muted-foreground">Memuat…</p>}>
            <FormLoader />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}

async function FormLoader() {
  const me = await requireGenerusWriter();
  const [units, jenjang] = await Promise.all([listAgendaUnits(me.claims), listJenjang(me.claims)]);
  return (
    <AgendaForm
      action={createAgenda}
      units={units}
      segments={segmentsOf(jenjang)}
      defaults={{ date: utcToZoned(new Date()).date }}
      zone={zoneLabel()}
      allowRepeat
      submitLabel="Simpan agenda"
    />
  );
}
