import { Suspense } from "react";
import type { Metadata } from "next";
import { BackLink, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireGenerusWriter } from "@/lib/auth";
import { listJenjang, listScopeUnits } from "@/lib/generus";
import { createGenerus } from "../actions";
import { GenerusForm } from "../generus-form";

export const metadata: Metadata = { title: "Tambah Generus · Generus" };

export default function BaruPage() {
  return (
    <>
      <BackLink href="/generus">Kembali ke daftar generus</BackLink>
      <PageHeader title="Tambah generus" />
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
  const [jenjang, kelompok] = await Promise.all([listJenjang(me.claims), listScopeUnits(me.claims, "write")]);
  return <GenerusForm action={createGenerus} defaults={{}} jenjang={jenjang} kelompok={kelompok} submitLabel="Simpan generus" />;
}
