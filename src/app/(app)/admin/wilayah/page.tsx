import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSuperadmin } from "@/lib/auth";
import { getWilayahTree } from "@/lib/wilayah";
import { AddUnitForm, UnitRow } from "./forms";

export const metadata: Metadata = { title: "Wilayah · Generus" };

export default function WilayahPage() {
  return (
    <>
      <PageHeader title="Wilayah" description="Desa dan kelompok di daerah ini. Unit hanya bisa dihapus bila sudah kosong." />
      <Suspense fallback={<p className="text-muted-foreground">Memuat…</p>}>
        <Tree />
      </Suspense>
    </>
  );
}

async function Tree() {
  const me = await requireSuperadmin();
  const tree = await getWilayahTree(me.claims);
  if (!tree.daerah) return <p className="text-muted-foreground">Belum ada unit daerah. Jalankan seed atau migrasi data.</p>;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{tree.daerah.name}</CardTitle>
          <CardDescription>
            {tree.desa.length} desa · {tree.desa.reduce((s, d) => s + d.kelompok.length, 0)} kelompok ·{" "}
            {tree.daerah.generusAktif.toLocaleString("id-ID")} generus aktif
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddUnitForm parentId={tree.daerah.id} level="desa" />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {tree.desa.map((desa) => (
          <Card key={desa.id}>
            <CardHeader>
              <UnitRow
                id={desa.id}
                name={desa.name}
                label="Desa"
                count={desa.generusAktif}
                deletable={desa.kelompok.length === 0}
                heading
              />
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {desa.kelompok.length === 0 && <p className="text-sm text-muted-foreground">Belum ada kelompok.</p>}
              {desa.kelompok.map((k) => (
                <UnitRow key={k.id} id={k.id} name={k.name} label="Kelompok" count={k.generusAktif} deletable={k.generusAktif === 0} />
              ))}
              <div className="mt-2 border-t pt-3">
                <AddUnitForm parentId={desa.id} level="kelompok" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Jumlah generus pada tiap unit bisa dilihat rinci di menu{" "}
        <Link href="/generus" className="underline">
          Generus
        </Link>
        .
      </p>
    </>
  );
}
