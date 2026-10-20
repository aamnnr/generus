import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "@/components/app-link";
import { notFound, redirect } from "next/navigation";
import { BackLink, EmptyState, PageHeader, Pill } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { canReadGenerus, getCurrentUser } from "@/lib/auth";
import { getTarget, getTargetRoster } from "@/lib/capaian";
import { ASPEK_LABEL, CAPAIAN_LABEL } from "@/lib/kurikulum-format";
import { TargetContent } from "../../../kurikulum/shared";
import { resolveCapaianContext } from "../../context";
import { AchievementChecklist } from "../../forms";
import { PageLoading } from "@/components/page-loading";

export const metadata: Metadata = { title: "Isi capaian · Generus" };

export default function TargetCapaianPage(props: PageProps<"/capaian/target/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Roster {...props} />
    </Suspense>
  );
}

const GENDER = { L: "Laki-laki", P: "Perempuan" } as const;
const TONE = { belum: "muted", proses: "accent", tuntas: "ok" } as const;

async function Roster({ params, searchParams }: PageProps<"/capaian/target/[id]">) {
  const [me, { id }, sp] = await Promise.all([getCurrentUser(), params, searchParams]);
  if (!canReadGenerus(me)) redirect("/kurikulum");
  const [ctx, target] = await Promise.all([resolveCapaianContext(me, sp), getTarget(me.claims, id)]);
  if (!target || !target.materi || target.materi.assessment !== "generus" || !ctx.kelompok) notFound();
  const rows = await getTargetRoster(me.claims, target.id, ctx.kelompok.id);
  const back = `/capaian${ctx.query({ periode: target.periodId, jenjang: target.jenjangId })}`;

  return (
    <>
      <BackLink href={back}>Kembali ke capaian</BackLink>
      <PageHeader
        title={target.materi.title}
        description={`${ASPEK_LABEL[target.aspek]} · ${target.mapel} · Kelompok ${ctx.kelompok.name}`}
      />
      {(target.materi.body || target.materi.arabic) && (
        <Card>
          <CardContent>
            <TargetContent t={target} />
          </CardContent>
        </Card>
      )}

      {rows.length === 0 && <EmptyState title="Tidak ada generus sasaran di kelompok ini" />}

      {rows.length > 0 &&
        (ctx.writer ? (
          <AchievementChecklist
            targetId={target.id}
            rows={rows.map((r) => ({
              generusId: r.generusId,
              name: r.name,
              meta: [GENDER[r.gender], r.kategori].filter(Boolean).join(" · "),
              status: r.status,
              aktif: r.aktif,
            }))}
          />
        ) : (
          <ul className="overflow-hidden rounded-2xl bg-card shadow-card">
            {rows.map((r, i) => (
              <li key={r.generusId} className={`relative flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 ${i < rows.length - 1 ? "border-b border-muted" : ""}`}>
                <Link href={`/generus/${r.generusId}`} className="min-w-0 flex-1 font-medium after:absolute after:inset-0 after:content-['']">
                  {r.name}
                </Link>
                <Pill tone={TONE[r.status]}>{CAPAIAN_LABEL[r.status]}</Pill>
              </li>
            ))}
          </ul>
        ))}
    </>
  );
}
