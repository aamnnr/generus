import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader, Pill } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurriculumEditor } from "@/lib/auth";
import { listKitab } from "@/lib/kurikulum";
import { formatPosition, KITAB_UNIT_LABEL } from "@/lib/kurikulum-format";
import { setKitabArchived } from "../actions";
import { KitabEditToggle, KitabForm } from "../forms";
import { KurikulumTabs } from "../shared";
import { PageLoading } from "@/components/page-loading";

export const metadata: Metadata = { title: "Kitab · Generus" };

export default function KitabPage() {
  return (
    <>
      <PageHeader
        title="Kurikulum"
        description="Lintasan progres berurutan. Al-Qur'an memakai posisi surat:ayat; kitab lain memakai halaman atau bab."
      />
      <KurikulumTabs active="kitab" />
      <Suspense fallback={<PageLoading />}>
        <KitabList />
      </Suspense>
    </>
  );
}

async function KitabList() {
  const me = await requireCurriculumEditor();
  const rows = await listKitab(me.claims, { includeArchived: true });
  return (
    <>
      <ul className="overflow-hidden rounded-2xl bg-card shadow-card">
        {rows.map((k, i) => (
          <li key={k.id} className={`px-4 py-3 ${i < rows.length - 1 ? "border-b border-muted" : ""}`}>
            <KitabEditToggle kitab={k}>
              <div className="flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {k.title}
                  {k.archived && <Pill tone="muted">Diarsipkan</Pill>}
                  {k.usedIn > 0 && <Pill tone="ok">Dipakai {k.usedIn}×</Pill>}
                </span>
                <span className="text-sm text-muted-foreground">
                  {KITAB_UNIT_LABEL[k.unit]} · {k.unit === "ayat" ? `${formatPosition("ayat", 1)} s.d. ${formatPosition("ayat", k.total)}` : `1–${k.total}`}
                </span>
                <form action={setKitabArchived}>
                  <input type="hidden" name="id" value={k.id} />
                  <input type="hidden" name="archived" value={k.archived ? "0" : "1"} />
                  <Button type="submit" size="xs" variant="ghost" className="-ml-2 text-muted-foreground">
                    {k.archived ? "Kembalikan dari arsip" : "Arsipkan"}
                  </Button>
                </form>
              </div>
            </KitabEditToggle>
          </li>
        ))}
      </ul>
      <Card>
        <CardHeader>
          <CardTitle>Tambah kitab</CardTitle>
          <CardDescription>
            Untuk Al-Qur&apos;an pilih satuan &ldquo;Ayat Al-Qur&apos;an&rdquo; dengan jumlah 6236. Isi jumlah halaman/bab sesuai kitab asli.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KitabForm />
        </CardContent>
      </Card>
    </>
  );
}
