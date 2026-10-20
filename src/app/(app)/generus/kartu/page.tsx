import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { generus, jenjang, jenjangKategori, units } from "@/db/schema";
import { withRls } from "@/db/rls";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { requireGenerusWriter } from "@/lib/auth";
import { jenjangLabel, listScopeUnits, type UnitOption } from "@/lib/generus";
import { qrPayload } from "@/lib/qr";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Kartu QR · Generus" };

const MAX_CARDS = 600;

const paramsSchema = z.object({
  unit: z.string().uuid().optional().catch(undefined),
  id: z.union([z.string().uuid(), z.array(z.string().uuid())]).optional().catch(undefined),
});

export default function KartuPage({ searchParams }: PageProps<"/generus/kartu">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Memuat…</p>}>
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
              kelompok: units.name,
              jenjang: jenjang.name,
              kategori: jenjangKategori.name,
            })
            .from(generus)
            .innerJoin(units, eq(units.id, generus.kelompokId))
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
      ...r,
      svg: await QRCode.toString(qrPayload(r.token), { type: "svg", errorCorrectionLevel: "M", margin: 0 }),
    })),
  );

  return (
    <>
      <div className="flex flex-col gap-3 print:hidden">
        <Link href="/generus" className="text-sm text-muted-foreground hover:text-foreground">
          ← Kembali ke daftar generus
        </Link>
        <h1 className="text-2xl font-semibold">Cetak kartu QR</h1>
        <p className="text-sm text-muted-foreground">
          10 kartu per lembar A4 (ukuran KTP). Saat mencetak pilih kertas A4, skala 100%, tanpa header/footer. Bisa juga
          &quot;Simpan sebagai PDF&quot;. Kartu berisi kode acak saja; kalau hilang, terbitkan ulang dari halaman generus.
        </p>
        {ids.length === 0 && (
          <form className="flex flex-wrap items-end gap-2">
            <UnitSelect options={desaOptions} value={unitId} />
            <Button type="submit" variant="outline">
              Tampilkan
            </Button>
          </form>
        )}
        {cards.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <PrintButton />
            <span className="text-sm text-muted-foreground">
              {cards.length} kartu · {Math.ceil(cards.length / 10)} lembar
              {rows.length === MAX_CARDS && ` (maksimal ${MAX_CARDS}; pilih wilayah lebih kecil)`}
            </span>
            {ids.length > 0 && (
              <Link href="/generus/kartu" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Cetak per wilayah
              </Link>
            )}
          </div>
        )}
        {(ids.length > 0 || unitId) && cards.length === 0 && <p className="text-muted-foreground">Tidak ada generus aktif.</p>}
      </div>

      {cards.length > 0 && (
        <div className="kartu-sheet">
          {cards.map((c) => (
            <div key={c.id} className="kartu">
              <div className="kartu-qr" dangerouslySetInnerHTML={{ __html: c.svg }} />
              <div className="kartu-info">
                <div className="kartu-brand">GENERUS</div>
                <div className="kartu-name">{c.name}</div>
                <div className="kartu-meta">Kelompok {c.kelompok}</div>
                <div className="kartu-meta">{jenjangLabel(c.jenjang, c.kategori)}</div>
                <div className="kartu-hint">Tunjukkan kartu ini saat presensi pengajian.</div>
              </div>
            </div>
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
    <NativeSelect name="unit" defaultValue={value ?? ""} required aria-label="Wilayah" className="min-w-64">
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
