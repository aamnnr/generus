import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Link href="/agenda" className="text-sm text-muted-foreground hover:text-foreground">
        ← Kembali ke agenda
      </Link>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Buat agenda</CardTitle>
        </CardHeader>
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
