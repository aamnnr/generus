import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "@/components/app-link";
import { BackLink, PageHeader } from "@/components/page-header";
import QRCode from "qrcode";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { generus, jenjang, jenjangKategori, units } from "@/db/schema";
import { withRls } from "@/db/rls";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { requireGenerusWriter } from "@/lib/auth";
import { jenjangLabel, listScopeUnits, type UnitOption } from "@/lib/generus";
import { qrPayload } from "@/lib/qr";
import { IdCard } from "./id-card";
import { PrintButton } from "./print-button";
import { PageLoading } from "@/components/page-loading";

export const metadata: Metadata = { title: "Kartu QR · Generus" };

const PER_SHEET = 9;
const desaUnit = alias(units, "desa");

const MAX_CARDS = 600;

const paramsSchema = z.object({
  unit: z.string().uuid().optional().catch(undefined),
  id: z.union([z.string().uuid(), z.array(z.string().uuid())]).optional().catch(undefined),
});

export default function KartuPage({ searchParams }: PageProps<"/generus/kartu">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Kartu searchParams={searchParams} />
    </Suspense>
  );
}

async function Kartu({ searchParams }: Pick<PageProps<"/generus/kartu">, "searchParams">) {
  const [me, raw] = await Promise.all([requireGenerusWriter(), searchParams]);
  const p = paramsSchema.parse(raw);
  const ids = p.id ? [p.id].flat() : [];
  const units_ = await listScopeUnits(me.claims, "write");
  const desaOptions = await listScopeUnits(me.claims, "read");
  const unitId = p.unit ?? (ids.length === 0 && units_.length === 1 ? units_[0].id : undefined);

  const rows =
    ids.length || unitId
      ? await withRls(me.claims, (tx) =>
          tx
            .select({
              id: generus.id,
              name: generus.name,
              token: generus.qrToken,
              gender: generus.gender,
              kelompok: units.name,
              desa: desaUnit.name,
              daerah: sql<string>`(SELECT d.name FROM units d WHERE d.path = subpath(${units.path}, 0, 1))`,
              jenjang: jenjang.name,
              kategori: jenjangKategori.name,
            })
            .from(generus)
            .innerJoin(units, eq(units.id, generus.kelompokId))
            .innerJoin(desaUnit, eq(desaUnit.id, units.parentId))
            .innerJoin(jenjang, eq(jenjang.id, generus.jenjangId))
            .leftJoin(jenjangKategori, eq(jenjangKategori.id, generus.kategoriId))
            .where(
              and(
                eq(generus.status, "aktif"),
                eq(generus.qrActive, true),
                ids.length
                  ? inArray(generus.id, ids)
                  : sql`${generus.unitPath} <@ (SELECT path FROM units WHERE id = ${unitId})`,
              ),
            )
            .orderBy(asc(units.name), asc(generus.name))
            .limit(MAX_CARDS),
        )
      : [];

  const cards = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      name: r.name,
      gender: r.gender,
      kelompok: r.kelompok,
      desa: r.desa,
      daerah: r.daerah,
      jenjang: jenjangLabel(r.jenjang, r.kategori),
      token: r.token,
      svg: await QRCode.toString(qrPayload(r.token), { type: "svg", errorCorrectionLevel: "M", margin: 0 }),
    })),
  );

  return (
    <>
      <div className="flex flex-col gap-4 print:hidden">
        <BackLink href="/generus">Kembali ke daftar generus</BackLink>
        <PageHeader
          title="Cetak kartu generus"
          description="Kartu identitas berdiri ukuran KTP (54 × 85,6 mm) untuk lanyard, 9 kartu per lembar A4. Saat mencetak pilih A4, skala 100%, aktifkan grafis latar, tanpa header/footer — atau Simpan sebagai PDF."
        />
        <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-card md:flex-row md:flex-wrap md:items-center">
          {ids.length === 0 && (
            <form className="flex flex-1 flex-wrap items-center gap-2">
              <UnitSelect options={desaOptions} value={unitId} />
              <Button type="submit" variant="outline">
                Tampilkan
              </Button>
            </form>
          )}
          {cards.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{cards.length} kartu</span> · {Math.ceil(cards.length / PER_SHEET)} lembar
                {rows.length === MAX_CARDS && ` (maksimal ${MAX_CARDS}; pilih wilayah lebih kecil)`}
              </span>
              <PrintButton />
              {ids.length > 0 && (
                <Link href="/generus/kartu" className={buttonVariants({ variant: "ghost" })}>
                  Cetak per wilayah
                </Link>
              )}
            </div>
          )}
          {(ids.length > 0 || unitId) && cards.length === 0 && <p className="text-muted-foreground">Tidak ada generus aktif.</p>}
        </div>
        <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
          QR hanya berisi kode acak, bukan data pribadi. Potong mengikuti garis putus-putus, lalu lubangi tanda di bagian atas untuk tali lanyard (atau pakai holder kartu). Kartu hilang? Terbitkan ulang dari halaman generus.
        </p>
      </div>

      {cards.length > 0 && (
        <div className="kartu-sheet">
          {cards.map((c) => (
            <IdCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </>
  );
}

function UnitSelect({ options, value }: { options: UnitOption[]; value?: string }) {
  const byDesa = new Map<string, UnitOption[]>();
  for (const o of options) byDesa.set(o.desaName, [...(byDesa.get(o.desaName) ?? []), o]);
  return (
    <NativeSelect name="unit" defaultValue={value ?? ""} required aria-label="Wilayah" className="min-w-0 sm:min-w-72">
      <NativeSelectOption value="" disabled>
        Pilih desa / kelompok
      </NativeSelectOption>
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
