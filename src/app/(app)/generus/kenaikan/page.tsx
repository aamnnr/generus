import { Suspense } from "react";
import type { Metadata } from "next";
import { BackLink, PageHeader } from "@/components/page-header";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { requireGenerusWriter } from "@/lib/auth";
import { listPromotionCandidates, listScopeUnits, MAX_PROMOTION_ROWS, type UnitOption } from "@/lib/generus";
import { academicYearStart, ageAt, isSuggested, TRANSITIONS, type TransitionKey } from "@/lib/kenaikan-rules";
import { PromoteForm } from "./promote-form";
import { PageLoading } from "@/components/page-loading";
import { QueryForm } from "@/components/query-form";

export const metadata: Metadata = { title: "Kenaikan Jenjang · Generus" };

const paramsSchema = z.object({
  t: z.enum(Object.keys(TRANSITIONS) as [TransitionKey]).catch("pra-ke-pelajar"),
  unit: z.string().uuid().optional().catch(undefined),
});

export default function KenaikanPage({ searchParams }: PageProps<"/generus/kenaikan">) {
  return (
    <>
      <BackLink href="/generus">Kembali ke daftar generus</BackLink>
      <PageHeader title="Kenaikan jenjang" description="Lakukan di awal tahun ajaran. Generus yang disarankan sudah dicentang; periksa lalu simpan." />
      <Suspense fallback={<PageLoading />}>
        <Kenaikan searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Kenaikan({ searchParams }: Pick<PageProps<"/generus/kenaikan">, "searchParams">) {
  const [me, raw] = await Promise.all([requireGenerusWriter(), searchParams]);
  const p = paramsSchema.parse(raw);
  const units = await listScopeUnits(me.claims, "read");
  const kelompokOnly = units.filter((u) => u.level === "kelompok");
  // Admin satu kelompok tidak perlu memilih wilayah.
  const unitId = p.unit ?? (kelompokOnly.length === 1 ? kelompokOnly[0].id : undefined);
  const t = TRANSITIONS[p.t];

  const today = new Date();
  const refDate = academicYearStart(today);
  const candidates = unitId ? await listPromotionCandidates(me.claims, t.from, unitId) : null;
  const rows =
    candidates?.rows.map((g) => ({
      ...g,
      age: ageAt(g.birthDate, refDate),
      suggested: isSuggested(p.t, g, today),
    })) ?? [];

  return (
    <>
      <Card>
        <CardContent>
          <QueryForm className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="flex flex-col gap-2">
              <label htmlFor="t" className="text-sm font-medium">
                Jenis kenaikan
              </label>
              <NativeSelect id="t" name="t" defaultValue={p.t}>
                {Object.entries(TRANSITIONS).map(([k, v]) => (
                  <NativeSelectOption key={k} value={k}>
                    {v.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            {kelompokOnly.length > 1 ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="unit" className="text-sm font-medium">
                  Wilayah
                </label>
                <UnitSelect options={units} value={unitId} />
              </div>
            ) : (
              <div />
            )}
            <Button type="submit" variant="outline">
              Tampilkan
            </Button>
          </QueryForm>
        </CardContent>
      </Card>

      {!unitId ? (
        <p className="text-muted-foreground">Pilih desa atau kelompok terlebih dahulu.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t.label}</CardTitle>
            <CardDescription>
              {t.hint} Usia dihitung per 1 Juli {refDate.getFullYear()}.
              {candidates?.truncated && ` Hanya ${MAX_PROMOTION_ROWS} generus pertama yang ditampilkan; pilih wilayah yang lebih kecil.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada generus {t.from.jenjang}{t.from.kategori ? ` ${t.from.kategori}` : ""} aktif di wilayah ini.</p>
            ) : (
              <PromoteForm transition={p.t} targetLabel={`${t.to.jenjang} ${t.to.kategori}`} rows={rows} />
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function UnitSelect({ options, value }: { options: UnitOption[]; value?: string }) {
  const byDesa = new Map<string, UnitOption[]>();
  for (const o of options) byDesa.set(o.desaName, [...(byDesa.get(o.desaName) ?? []), o]);
  return (
    <NativeSelect id="unit" name="unit" defaultValue={value ?? ""} required>
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
