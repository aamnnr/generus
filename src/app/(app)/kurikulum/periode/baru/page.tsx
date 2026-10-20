import { Suspense } from "react";
import type { Metadata } from "next";
import { BackLink, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireCurriculumEditor } from "@/lib/auth";
import { listPeriods } from "@/lib/kurikulum";
import { PeriodForm } from "../../forms";
import { PageLoading } from "@/components/page-loading";

export const metadata: Metadata = { title: "Buat periode · Generus" };

export default function PeriodeBaruPage() {
  return (
    <>
      <BackLink href="/kurikulum">Kembali ke kurikulum</BackLink>
      <PageHeader title="Buat periode" description="Periode baru dimulai sebagai draf; kelompok baru melihatnya setelah diterbitkan." />
      <Card className="max-w-3xl">
        <CardContent>
          <Suspense fallback={<PageLoading />}>
            <Form />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function Form() {
  const me = await requireCurriculumEditor();
  const periods = await listPeriods(me.claims);
  const last = periods[0];
  // Periode berikutnya biasanya mulai sehari setelah periode terakhir, ±5 pekan.
  const startsOn = last ? addDays(last.endsOn, 1) : undefined;
  return (
    <PeriodForm
      defaults={{ semester: last?.semester, startsOn, endsOn: startsOn ? addDays(startsOn, 34) : undefined, copyFrom: last?.id }}
      copyOptions={periods.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
