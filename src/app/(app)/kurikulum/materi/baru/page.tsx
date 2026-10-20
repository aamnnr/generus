import { Suspense } from "react";
import type { Metadata } from "next";
import { BackLink, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireCurriculumEditor } from "@/lib/auth";
import { listMapelNames } from "@/lib/kurikulum";
import { MateriForm } from "../../forms";

export const metadata: Metadata = { title: "Tambah materi · Generus" };

export default function MateriBaruPage() {
  return (
    <>
      <BackLink href="/kurikulum/materi">Kembali ke pustaka materi</BackLink>
      <PageHeader title="Tambah materi" description="Materi disimpan di pustaka dan bisa dipilih di periode mana pun." />
      <Card className="max-w-3xl">
        <CardContent>
          <Suspense fallback={<p className="text-muted-foreground">Memuat…</p>}>
            <Form />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}

async function Form() {
  const me = await requireCurriculumEditor();
  return <MateriForm defaults={{}} mapelSuggestions={await listMapelNames(me.claims)} />;
}
