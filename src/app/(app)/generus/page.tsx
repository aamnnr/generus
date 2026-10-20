import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canWriteGenerus, requireGenerusReader } from "@/lib/auth";
import {
  ageOn,
  jenjangLabel,
  JENJANG_FILTERS,
  listGenerus,
  listScopeUnits,
  PAGE_SIZE,
  STATUS_LABEL,
  type GenerusFilters,
  type UnitOption,
} from "@/lib/generus";

export const metadata: Metadata = { title: "Generus · Generus" };

const filterSchema = z.object({
  q: z.string().max(80).optional().catch(undefined),
  unit: z.string().uuid().optional().catch(undefined),
  jenjang: z.enum(Object.keys(JENJANG_FILTERS) as [keyof typeof JENJANG_FILTERS]).optional().catch(undefined),
  status: z.enum(["aktif", "pindah_sambung", "menikah", "semua"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
});

export default function GenerusPage({ searchParams }: PageProps<"/generus">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Memuat…</p>}>
      <GenerusList searchParams={searchParams} />
    </Suspense>
  );
}

async function GenerusList({ searchParams }: Pick<PageProps<"/generus">, "searchParams">) {
  const [me, raw] = await Promise.all([requireGenerusReader(), searchParams]);
  const p = filterSchema.parse(raw);
  const filters: GenerusFilters = { q: p.q, unitId: p.unit, jenjang: p.jenjang, status: p.status, page: p.page };
  const [{ rows, total }, unitOptions] = await Promise.all([
    listGenerus(me.claims, filters),
    listScopeUnits(me.claims, "read"),
  ]);
  const page = p.page ?? 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const singleKelompok = unitOptions.filter((u) => u.level === "kelompok").length <= 1;

  const pageHref = (n: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: p.q, unit: p.unit, jenjang: p.jenjang, status: p.status })) if (v) sp.set(k, v);
    if (n > 1) sp.set("page", String(n));
    const qs = sp.toString();
    return qs ? `/generus?${qs}` : "/generus";
  };

  return (
    <>
      {raw.pesan === "dihapus" && (
        <Alert>
          <AlertDescription>Data generus dihapus.</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Generus</h1>
        {canWriteGenerus(me) && (
          <div className="flex flex-wrap gap-2">
            <Link href="/generus/kartu" className={buttonVariants({ variant: "outline" })}>
              Cetak kartu QR
            </Link>
            <Link href="/generus/kenaikan" className={buttonVariants({ variant: "outline" })}>
              Kenaikan jenjang
            </Link>
            <Link href="/generus/import" className={buttonVariants({ variant: "outline" })}>
              Import Excel
            </Link>
            <Link href="/generus/baru" className={buttonVariants()}>
              Tambah generus
            </Link>
          </div>
        )}
      </div>

      <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" role="search">
        <Input name="q" defaultValue={p.q} placeholder="Cari nama" aria-label="Cari nama" className="lg:col-span-2" />
        {!singleKelompok && <UnitSelect options={unitOptions} value={p.unit} />}
        <NativeSelect name="jenjang" defaultValue={p.jenjang ?? ""} aria-label="Jenjang">
          <NativeSelectOption value="">Semua jenjang</NativeSelectOption>
          {Object.entries(JENJANG_FILTERS).map(([k, v]) => (
            <NativeSelectOption key={k} value={k}>
              {v.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={p.status ?? "aktif"} aria-label="Status">
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <NativeSelectOption key={k} value={k}>
              {v}
            </NativeSelectOption>
          ))}
          <NativeSelectOption value="semua">Semua status</NativeSelectOption>
        </NativeSelect>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
          <Button type="submit" variant="outline">
            Terapkan
          </Button>
          <Link href="/generus" className={buttonVariants({ variant: "ghost" })}>
            Reset
          </Link>
        </div>
      </form>

      <p className="text-sm text-muted-foreground">{total.toLocaleString("id-ID")} generus</p>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead className="hidden sm:table-cell">L/P</TableHead>
              <TableHead className="hidden sm:table-cell">Usia</TableHead>
              <TableHead>Jenjang</TableHead>
              {!singleKelompok && <TableHead className="hidden md:table-cell">Kelompok</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Tidak ada generus yang cocok.
                </TableCell>
              </TableRow>
            )}
            {rows.map((g) => (
              <TableRow key={g.id}>
                <TableCell>
                  <Link href={`/generus/${g.id}`} className="font-medium underline-offset-4 hover:underline">
                    {g.name}
                  </Link>
                  {g.status !== "aktif" && (
                    <Badge variant="outline" className="ml-2">
                      {STATUS_LABEL[g.status]}
                    </Badge>
                  )}
                  {!singleKelompok && (
                    <div className="text-xs text-muted-foreground md:hidden">
                      {g.kelompok} · {g.desa}
                    </div>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell">{g.gender}</TableCell>
                <TableCell className="hidden tabular-nums sm:table-cell">{ageOn(g.birthDate)}</TableCell>
                <TableCell>{jenjangLabel(g.jenjang, g.kategori)}</TableCell>
                {!singleKelompok && (
                  <TableCell className="hidden md:table-cell">
                    {g.kelompok} <span className="text-muted-foreground">· {g.desa}</span>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-2 text-sm" aria-label="Halaman">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              ← Sebelumnya
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Halaman {page} dari {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Berikutnya →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

function UnitSelect({ options, value }: { options: UnitOption[]; value?: string }) {
  const byDesa = new Map<string, UnitOption[]>();
  for (const o of options) byDesa.set(o.desaName, [...(byDesa.get(o.desaName) ?? []), o]);
  return (
    <NativeSelect name="unit" defaultValue={value ?? ""} aria-label="Wilayah">
      <NativeSelectOption value="">Semua wilayah</NativeSelectOption>
      {[...byDesa].map(([desa, opts]) => (
        <NativeSelectOptGroup key={desa} label={`Desa ${desa}`}>
          {opts.map((o) => (
            <NativeSelectOption key={o.id} value={o.id}>
              {o.level === "desa" ? `Seluruh Desa ${o.name}` : `Kelompok ${o.name}`}
            </NativeSelectOption>
          ))}
        </NativeSelectOptGroup>
      ))}
    </NativeSelect>
  );
}
