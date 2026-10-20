import { Suspense } from "react";
import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { generus } from "@/db/schema";
import { withRls } from "@/db/rls";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, roleLabel } from "@/lib/auth";

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
