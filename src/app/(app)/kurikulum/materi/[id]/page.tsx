import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { BackLink, PageHeader, Pill } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireCurriculumEditor } from "@/lib/auth";
import { listMapelNames, listMateri } from "@/lib/kurikulum";
import { ASPEK_LABEL } from "@/lib/kurikulum-format";
import { setMateriArchived } from "../../actions";
import { MateriForm } from "../../forms";

export const metadata: Metadata = { title: "Ubah materi · Generus" };

export default function MateriDetailPage({ params }: PageProps<"/kurikulum/materi/[id]">) {
  return (
    <>
      <BackLink href="/kurikulum/materi">Kembali ke pustaka materi</BackLink>
      <Suspense fallback={<p className="text-muted-foreground">Memuat…</p>}>
        <Detail params={params} />
      </Suspense>
    </>
  );
}

async function Detail({ params }: Pick<PageProps<"/kurikulum/materi/[id]">, "params">) {
  const [me, { id }] = await Promise.all([requireCurriculumEditor(), params]);
  const [active, archived, mapel] = await Promise.all([
    listMateri(me.claims),
    listMateri(me.claims, { archived: true }),
    listMapelNames(me.claims),
  ]);
  const m = [...active, ...archived].find((x) => x.id === id);
  if (!m) notFound();

  return (
    <>
      <PageHeader
        title={m.title}
        description={`${ASPEK_LABEL[m.aspek]} · ${m.mapel}`}
        badges={
          <>
            {m.archived && <Pill tone="muted">Diarsipkan</Pill>}
            {m.usedIn > 0 && <Pill tone="ok">Dipakai di {m.usedIn} target</Pill>}
          </>
        }
      />
      <Card className="max-w-3xl">
        <CardContent className="flex flex-col gap-4">
          {m.usedIn > 0 && (
            <p className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
              Perubahan isi juga tampil di periode yang sudah memakai materi ini.
            </p>
          )}
          <MateriForm defaults={m} mapelSuggestions={mapel} />
        </CardContent>
      </Card>
      <form action={setMateriArchived} className="flex flex-col gap-1">
        <input type="hidden" name="id" value={m.id} />
        <input type="hidden" name="archived" value={m.archived ? "0" : "1"} />
        <Button type="submit" variant="outline" className="w-fit">
          {m.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          {m.archived ? "Kembalikan dari arsip" : "Arsipkan materi"}
        </Button>
        {!m.archived && <p className="text-xs text-muted-foreground">Materi arsip tidak muncul di pilihan target baru, tetapi target lama tetap utuh.</p>}
      </form>
    </>
  );
}
