import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Send, Undo2 } from "lucide-react";
import { BackLink, EmptyState, PageHeader } from "@/components/page-header";
import { SegmentNav } from "@/components/segment-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { canEditCurriculum, getCurrentUser } from "@/lib/auth";
import {
  getPeriod,
  groupTargets,
  listJenjangWithKategori,
  listKitab,
  listMapelNames,
  listMateri,
  listTargets,
  type TargetRow,
} from "@/lib/kurikulum";
import { ASPEK_LABEL, positionInput } from "@/lib/kurikulum-format";
import { setPublished } from "../../actions";
import { AddTargetPanel, Collapsible, DeletePeriodButton, PeriodForm, TargetRowEditor, type TargetDefaults, type TargetFormData } from "../../forms";
import { dateRange, PeriodPills, TargetContent, todayIso } from "../../shared";
import { PageLoading } from "@/components/page-loading";

export const metadata: Metadata = { title: "Target periode · Generus" };

export default function PeriodePage({ params, searchParams }: PageProps<"/kurikulum/periode/[id]">) {
  return (
    <>
      <BackLink href="/kurikulum">Kembali ke kurikulum</BackLink>
      <Suspense fallback={<PageLoading />}>
        <Periode params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function toDefaults(t: TargetRow): TargetDefaults {
  return {
    id: t.id,
    kind: t.kitab ? "kitab" : "materi",
    aspek: t.aspek,
    mapel: t.mapel,
    materiId: t.materi?.id ?? null,
    kitabId: t.kitab?.id ?? null,
    from: t.kitab ? positionInput(t.kitab.unit, t.kitab.from) : undefined,
    to: t.kitab ? positionInput(t.kitab.unit, t.kitab.to) : undefined,
    note: t.note,
    strategy: t.strategy,
    kategoriId: t.kategoriId,
    gender: t.gender,
    optional: t.optional,
  };
}

async function Periode({ params, searchParams }: PageProps<"/kurikulum/periode/[id]">) {
  const [me, { id }, sp] = await Promise.all([getCurrentUser(), params, searchParams]);
  const editor = canEditCurriculum(me);
  const [period, jenjang] = await Promise.all([getPeriod(me.claims, id), listJenjangWithKategori(me.claims)]);
  if (!period) notFound();

  const current = jenjang.find((j) => j.id === sp.jenjang) ?? jenjang.find((j) => j.name === "Remaja") ?? jenjang[0];
  const targets = await listTargets(me.claims, period.id, current.id);
  const groups = groupTargets(targets);

  let formData: TargetFormData | null = null;
  if (editor) {
    const [materi, kitab, mapelSuggestions] = await Promise.all([listMateri(me.claims), listKitab(me.claims), listMapelNames(me.claims)]);
    const strategies: Record<string, string> = {};
    for (const t of targets) if (t.strategy) strategies[`${t.aspek}|${t.mapel}`] = t.strategy;
    formData = {
      periodId: period.id,
      jenjangId: current.id,
      kategori: current.kategori,
      materi: materi.map((m) => ({ id: m.id, aspek: m.aspek, mapel: m.mapel, title: m.title, assessment: m.assessment })),
      kitab: kitab.map((k) => ({ id: k.id, title: k.title, unit: k.unit, total: k.total })),
      mapelSuggestions,
      strategies,
    };
  }

  return (
    <>
      <PageHeader
        title={`Periode ${period.name}`}
        badges={<PeriodPills p={period} today={todayIso()} />}
        description={`Semester ${period.semester} · Waktu pembelajaran ${dateRange(period.startsOn, period.endsOn)}`}
        actions={
          editor && (
            <form action={setPublished}>
              <input type="hidden" name="id" value={period.id} />
              <input type="hidden" name="publish" value={period.publishedAt ? "0" : "1"} />
              <Button type="submit" variant={period.publishedAt ? "outline" : "default"}>
                {period.publishedAt ? <Undo2 aria-hidden /> : <Send aria-hidden />}
                {period.publishedAt ? "Kembalikan ke draf" : "Terbitkan"}
              </Button>
            </form>
          )
        }
      />

      {editor && !period.publishedAt && (
        <p className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
          Masih draf: hanya Tim Kurikulum yang bisa melihat. Terbitkan setelah target semua jenjang selesai disusun.
        </p>
      )}

      {editor && (
        <Collapsible label="Pengaturan periode">
          <Card className="max-w-3xl">
            <CardContent className="flex flex-col gap-6">
              <PeriodForm defaults={{ id: period.id, name: period.name, semester: period.semester, startsOn: period.startsOn, endsOn: period.endsOn }} />
              <DeletePeriodButton id={period.id} name={period.name} />
            </CardContent>
          </Card>
        </Collapsible>
      )}

      <SegmentNav
        label="Jenjang"
        items={jenjang.map((j) => ({ href: `/kurikulum/periode/${period.id}?jenjang=${j.id}`, label: j.name, active: j.id === current.id }))}
      />

      {groups.length === 0 && (
        <EmptyState
          title={`Belum ada target untuk ${current.name}`}
          description={editor ? "Tambahkan target dari pustaka materi, materi baru, atau rentang kitab." : undefined}
        />
      )}

      {groups.map((g, gi) => (
        <Card key={g.aspek}>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">{gi + 1}</span>
              {ASPEK_LABEL[g.aspek]}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {g.mapel.map((mp) => (
              <section key={mp.mapel} className="flex flex-col gap-2">
                <div className="flex flex-col gap-0.5 border-b border-muted pb-2">
                  <h3 className="font-bold text-primary">{mp.mapel}</h3>
                  {mp.strategy && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold">Strategi:</span> {mp.strategy}
                    </p>
                  )}
                </div>
                <ol className="flex flex-col gap-3">
                  {mp.targets.map((t) => {
                    const flat = g.mapel.flatMap((x) => x.targets);
                    const idx = flat.indexOf(t);
                    return (
                      <li key={t.id}>
                        {formData ? (
                          <TargetRowEditor data={formData} defaults={toDefaults(t)} first={idx === 0} last={idx === flat.length - 1}>
                            <TargetContent t={t} />
                          </TargetRowEditor>
                        ) : (
                          <TargetContent t={t} />
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </CardContent>
        </Card>
      ))}

      {formData && <AddTargetPanel data={formData} />}
    </>
  );
}
