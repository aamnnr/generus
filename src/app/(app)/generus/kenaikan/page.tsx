import { Suspense } from "react";
import type { Metadata } from "next";
import { BackLink, PageHeader } from "@/components/page-header";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { UnitPicker } from "@/components/unit-picker";
import { buildUnitTree } from "@/lib/unit-tree";
import { requireGenerusWriter } from "@/lib/auth";
import { listPromotionCandidates, listScopeUnits, MAX_PROMOTION_ROWS } from "@/lib/generus";
import { academicYearStart, ageAt, isPromotionSeason, segmentLabel, suggestPromotion, TRANSITIONS, type TransitionKey } from "@/lib/kenaikan-rules";
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
  const unitTree = kelompokOnly.length > 1 ? await buildUnitTree(me.claims, units.map((u) => u.id)) : [];
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
      ...suggestPromotion(p.t, g, today),
    })) ?? [];
  // Kenaikan antarjenjang sekolah: kelas akhir SD = 6, SLTP = 9.
  const lastGrade = t.from.jenjang === "Pra Remaja" ? 9 : p.t === "sd-ke-pra" ? 6 : null;
  const school = lastGrade === 9 ? "SMPN 2 kelas 8" : "SDN 1 kelas 5";

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
                <UnitPicker id="unit" units={unitTree} name="unit" defaultValue={unitId} required placeholder="Pilih desa / kelompok" />
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
              {t.hint} Centang hanya yang benar-benar naik; yang tidak dicentang tetap di jenjangnya. Usia dihitung per 1 Juli {refDate.getFullYear()}.
              {lastGrade &&
                (isPromotionSeason(today)
                  ? ` Generus yang tercatat kelas ${lastGrade} dianggap baru lulus; kelas di bawahnya tidak disarankan.`
                  : ` Di luar Juli–Agustus, generus yang tercatat kelas ${lastGrade} dianggap masih duduk di kelas ${lastGrade} dan tidak disarankan.`)}
              {lastGrade && ` Tulis kelas di kolom Sekolah (mis. "${school}") agar saran lebih tepat.`}
              {candidates?.truncated && ` Hanya ${MAX_PROMOTION_ROWS} generus pertama yang ditampilkan; pilih wilayah yang lebih kecil.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada generus {segmentLabel(t.from)} aktif di wilayah ini.</p>
            ) : (
              <PromoteForm transition={p.t} targetLabel={segmentLabel(t.to)} rows={rows} />
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
