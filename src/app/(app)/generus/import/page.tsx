import { Suspense } from "react";
import type { Metadata } from "next";
import { BackLink, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireGenerusWriter } from "@/lib/auth";
import { listScopeUnits } from "@/lib/generus";
import { ImportFlow } from "./import-flow";

export const metadata: Metadata = { title: "Import Generus · Generus" };

export default function ImportPage() {
  return (
    <>
      <BackLink href="/generus">Kembali ke daftar generus</BackLink>
      <PageHeader title="Import dari Excel" description="Tambahkan banyak generus sekaligus dari template. File diperiksa dulu sebelum disimpan." />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Unggah file</CardTitle>
          </CardHeader>
          <CardContent>
            <ImportFlow />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cara mengisi</CardTitle>
            <CardDescription>
              <a href="/templates/Template_Data_Generus.xlsx" download className="font-medium text-foreground underline">
                Unduh template Excel
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <ol className="list-decimal space-y-1 pl-5">
              <li>Isi sheet Wilayah dengan nama desa & kelompok persis seperti di bawah.</li>
              <li>Isi sheet Generus, satu baris per generus. Baris contoh (baris 2) otomatis dilewati.</li>
              <li>Generus yang sudah terdaftar (nama + tanggal lahir sama di kelompok yang sama) dilewati.</li>
            </ol>
            <Suspense fallback={<p className="text-muted-foreground">Memuat kelompok…</p>}>
              <KelompokList />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

async function KelompokList() {
  const me = await requireGenerusWriter();
  const kelompok = await listScopeUnits(me.claims, "write");
  return (
    <div>
      <p className="mb-1 font-medium">Kelompok yang bisa Anda isi ({kelompok.length}):</p>
      <ul className="max-h-64 overflow-y-auto rounded-md border px-3 py-2 font-mono text-xs leading-6">
        {kelompok.map((k) => (
          <li key={k.id}>
            {k.desaName} / {k.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
