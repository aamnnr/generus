import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { generus } from "@/db/schema";
import { withRls } from "@/db/rls";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { InstallPrompt } from "@/components/install-prompt";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canWriteGenerus, getCurrentUser, roleLabel } from "@/lib/auth";
import { isPromotionSeason } from "@/lib/kenaikan-rules";

export const metadata: Metadata = { title: "Beranda · Generus" };

export default function BerandaPage({ searchParams }: PageProps<"/beranda">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Memuat…</p>}>
      <Beranda searchParams={searchParams} />
    </Suspense>
  );
}

async function Beranda({ searchParams }: Pick<PageProps<"/beranda">, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const counts = await withRls(user.claims, async (tx) => {
    const [row] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        praRemaja: sql<number>`count(*) FILTER (WHERE j.name = 'Pra Remaja')::int`,
        remaja: sql<number>`count(*) FILTER (WHERE j.name = 'Remaja')::int`,
      })
      .from(generus)
      .innerJoin(sql`jenjang j`, sql`j.id = ${generus.jenjangId}`)
      .where(sql`${generus.status} = 'aktif'`);
    return row;
  });
  const canSeeGenerus = user.roles.some((r) => r.role !== "kurikulum");

  return (
    <>
      {params.status === "password-diganti" && (
        <Alert>
          <AlertDescription>Password berhasil diganti.</AlertDescription>
        </Alert>
      )}
      {canWriteGenerus(user) && isPromotionSeason(new Date()) && (
        <Alert>
          <AlertDescription>
            Awal tahun ajaran: periksa generus yang lulus SLTP atau selesai sekolah di{" "}
            <Link href="/generus/kenaikan" className="font-medium underline">
              Kenaikan jenjang
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Assalamu&apos;alaikum, {user.name}</h1>
        <div className="flex flex-wrap gap-2">
          {user.roles.length === 0 && <span className="text-sm text-muted-foreground">Belum punya peran.</span>}
          {user.roles.map((r) => (
            <Badge key={`${r.role}-${r.unitId}`} variant="secondary">
              {roleLabel(r)} · {r.unitName}
            </Badge>
          ))}
        </div>
      </div>

      <InstallPrompt />

      {canSeeGenerus && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat title="Generus aktif" value={counts.total} hint="Dalam lingkup akses Anda" />
          <Stat title="Pra Remaja" value={counts.praRemaja} />
          <Stat title="Remaja" value={counts.remaja} />
        </div>
      )}
    </>
  );
}

function Stat({ title, value, hint }: { title: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value.toLocaleString("id-ID")}</CardTitle>
      </CardHeader>
      {hint && <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>}
    </Card>
  );
}
