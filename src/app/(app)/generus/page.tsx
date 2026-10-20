import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "@/components/app-link";
import { ChevronRight, Plus, Search } from "lucide-react";
import { FilterDisclosure } from "@/components/filter-disclosure";
import { initials } from "@/components/shell/nav";
import { MosqueSilhouette } from "@/components/shell/ornament";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { PageLoading } from "@/components/page-loading";

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
    <Suspense fallback={<PageLoading />}>
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

  const href = (o: Partial<Record<"q" | "unit" | "jenjang" | "status" | "page", string | undefined>>) => {
    const sp = new URLSearchParams();
    const merged = { q: p.q, unit: p.unit, jenjang: p.jenjang, status: p.status, page: undefined as string | undefined, ...o };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "page" && v === "1")) sp.set(k, v);
    const qs = sp.toString();
    return qs ? `/generus?${qs}` : "/generus";
  };
  const writer = canWriteGenerus(me);
  const chips: { key: string | undefined; label: string }[] = [
    { key: undefined, label: "Semua" },
    ...Object.entries(JENJANG_FILTERS)
      .filter(([k]) => k !== "remaja")
      .map(([k, v]) => ({ key: k, label: v.label })),
  ];
  const statusLabel = p.status === "semua" ? "generus" : STATUS_LABEL[p.status ?? "aktif"].toLowerCase();

  return (
    <>
      {raw.pesan === "dihapus" && (
        <Alert>
          <AlertDescription>Data generus dihapus.</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="text-2xl font-bold">Generus</h1>
          <span className="text-sm text-muted-foreground">
            {total.toLocaleString("id-ID")} {statusLabel}
          </span>
        </div>
        {writer && (
          <div className="hidden flex-wrap gap-2 md:flex">
            <Link href="/generus/kenaikan" className={buttonVariants({ variant: "outline" })}>
              Kenaikan jenjang
            </Link>
            <Link href="/generus/import" className={buttonVariants({ variant: "outline" })}>
              Import Excel
            </Link>
            <Link href="/generus/kartu" className={buttonVariants({ variant: "outline" })}>
              Cetak kartu QR
            </Link>
            <Link href="/generus/baru" className={buttonVariants()}>
              <Plus aria-hidden /> Tambah generus
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 md:rounded-2xl md:bg-card md:p-4 md:shadow-card">
        <form role="search" className="flex flex-wrap items-center gap-2">
          {p.jenjang && <input type="hidden" name="jenjang" value={p.jenjang} />}
          <label className="flex h-11 min-w-0 flex-[1_1_220px] items-center gap-2 rounded-full border border-border bg-card px-4 text-muted-foreground md:h-10 md:border-0 md:bg-background">
            <Search className="size-[18px] shrink-0" aria-hidden />
            <input
              name="q"
              defaultValue={p.q}
              placeholder="Cari nama"
              aria-label="Cari nama"
              className="w-full min-w-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground md:text-[15px]"
            />
          </label>
          <FilterDisclosure label={singleKelompok ? "Status" : "Wilayah & status"}>
              {!singleKelompok && <UnitSelect options={unitOptions} value={p.unit} />}
              <NativeSelect name="status" defaultValue={p.status ?? "aktif"} aria-label="Status" className="md:w-44">
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <NativeSelectOption key={k} value={k}>
                    {v}
                  </NativeSelectOption>
                ))}
                <NativeSelectOption value="semua">Semua status</NativeSelectOption>
              </NativeSelect>
              <Button type="submit" variant="outline">
                Terapkan
              </Button>
          </FilterDisclosure>
        </form>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Jenjang">
          {chips.map((c) => {
            const on = p.jenjang === c.key;
            return (
              <Link
                key={c.label}
                href={href({ jenjang: c.key, page: undefined })}
                aria-current={on ? "true" : undefined}
                className={`flex h-9 shrink-0 items-center rounded-full px-4 text-sm whitespace-nowrap ${
                  on ? "bg-primary font-semibold text-primary-foreground" : "bg-tile text-foreground hover:bg-secondary"
                }`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      </div>

      {rows.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-10 text-center shadow-card">
          <MosqueSilhouette className="w-24 text-brass opacity-40" />
          <p className="font-bold">Tidak ada generus yang cocok</p>
          <Link href="/generus" className="text-sm font-semibold text-primary">
            Hapus filter
          </Link>
        </div>
      )}

      {/* HP: kartu */}
      {rows.length > 0 && (
        <ul className="flex flex-col gap-2 md:hidden">
          {rows.map((g) => (
            <li key={g.id}>
              <Link href={`/generus/${g.id}`} className="flex items-center gap-3 rounded-2xl bg-card px-3.5 py-3 shadow-card">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
                  {initials(g.name)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{g.name}</span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {g.gender} · {ageOn(g.birthDate)} th{singleKelompok ? "" : ` · ${g.kelompok}`}
                    {g.status !== "aktif" ? ` · ${STATUS_LABEL[g.status]}` : ""}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                  {g.kategori ?? g.jenjang}
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Desktop: tabel */}
      {rows.length > 0 && (
        <div className="hidden overflow-x-auto rounded-2xl bg-card shadow-card md:block">
          <Table>
            <TableHeader>
              <TableRow className="text-xs tracking-wide">
                <TableHead className="pl-4">NAMA</TableHead>
                <TableHead>L/P</TableHead>
                <TableHead>USIA</TableHead>
                <TableHead>JENJANG</TableHead>
                {!singleKelompok && <TableHead>KELOMPOK</TableHead>}
                <TableHead>STATUS</TableHead>
                <TableHead className="w-10 pr-4">
                  <span className="sr-only">Buka</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((g) => (
                <TableRow key={g.id} className="relative cursor-pointer hover:bg-secondary/50">
                  <TableCell className="pl-4">
                    <Link href={`/generus/${g.id}`} className="flex items-center gap-3 font-semibold after:absolute after:inset-0 after:content-['']">
                      <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                        {initials(g.name)}
                      </span>
                      {g.name}
                    </Link>
                  </TableCell>
                  <TableCell>{g.gender}</TableCell>
                  <TableCell className="tabular-nums">{ageOn(g.birthDate)}</TableCell>
                  <TableCell>
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-accent-foreground">
                      {jenjangLabel(g.jenjang, g.kategori)}
                    </span>
                  </TableCell>
                  {!singleKelompok && (
                    <TableCell className="whitespace-nowrap">
                      {g.kelompok} <span className="text-muted-foreground">· {g.desa}</span>
                    </TableCell>
                  )}
                  <TableCell>{STATUS_LABEL[g.status]}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <ChevronRight className="inline size-[18px] text-muted-foreground" aria-hidden />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pages > 1 && (
        <nav className="flex flex-wrap items-center justify-between gap-2 text-sm" aria-label="Halaman">
          {page > 1 ? (
            <Link href={href({ page: String(page - 1) })} className={buttonVariants({ variant: "outline", size: "sm" })}>
              ← Sebelumnya
            </Link>
          ) : (
            <span />
          )}
          <span className="font-semibold">
            Halaman {page} dari {pages}
          </span>
          {page < pages ? (
            <Link href={href({ page: String(page + 1) })} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Berikutnya →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      {writer && (
        <Link
          href="/generus/baru"
          aria-label="Tambah generus"
          className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float md:hidden"
        >
          <Plus className="size-6" aria-hidden />
        </Link>
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
