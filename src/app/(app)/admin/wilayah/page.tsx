import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "@/components/app-link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSuperadmin } from "@/lib/auth";
import { getWilayahTree } from "@/lib/wilayah";
import { AddUnitForm, UnitRow } from "./forms";
import { PageLoading } from "@/components/page-loading";

export const metadata: Metadata = { title: "Wilayah · Generus" };

export default function WilayahPage() {
  return (
    <>
      <PageHeader title="Wilayah" description="Daerah, desa, dan kelompok dalam lingkup Anda. Unit hanya bisa dihapus bila sudah kosong." />
      <Suspense fallback={<PageLoading />}>
        <Tree />
      </Suspense>
    </>
  );
}

async function Tree() {
  const me = await requireSuperadmin();
  const daerahList = await getWilayahTree(me);

  return (
    <>
      {me.isSystemAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Tambah daerah</CardTitle>
            <CardDescription>Hanya superadmin sistem. Desa & kelompok lalu ditambahkan di kartu daerahnya.</CardDescription>
          </CardHeader>
          <CardContent>
            <AddUnitForm level="daerah" />
          </CardContent>
        </Card>
      )}

      {daerahList.length === 0 && <p className="text-muted-foreground">Belum ada daerah di lingkup Anda.</p>}

      {daerahList.map((daerah) => (
        <section key={daerah.id} className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              {me.isSystemAdmin ? (
                <UnitRow id={daerah.id} name={daerah.name} label="Daerah" count={daerah.generusAktif} deletable={daerah.desa.length === 0} heading />
              ) : (
                <CardTitle>Daerah {daerah.name}</CardTitle>
              )}
              <CardDescription>
                {daerah.desa.length} desa · {daerah.desa.reduce((s, d) => s + d.kelompok.length, 0)} kelompok ·{" "}
                {daerah.generusAktif.toLocaleString("id-ID")} generus aktif
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AddUnitForm parentId={daerah.id} level="desa" />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {daerah.desa.map((desa) => (
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
        </section>
      ))}
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
