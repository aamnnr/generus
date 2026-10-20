import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { canEditCurriculum, getCurrentUser } from "@/lib/auth";
import { KurikulumTabs } from "./tabs-nav";

// Bingkai bersama Periode target / Pustaka materi / Kitab. Judul & tab tetap di
// tempat saat berpindah bagian; hanya isinya yang berganti. Suspense di sini
// bertahan antar-navigasi, jadi isi lama tetap tampil sampai isi baru siap
// (tanpa kerangka berkedip), sementara bilah progres menandai proses.
export default function KurikulumTabsLayout({ children }: LayoutProps<"/kurikulum">) {
  return (
    <>
      <PageHeader title="Kurikulum" />
      <Suspense fallback={null}>
        <EditorTabs />
      </Suspense>
      <Suspense fallback={<PageLoading />}>{children}</Suspense>
    </>
  );
}

async function EditorTabs() {
  const me = await getCurrentUser();
  return canEditCurriculum(me) ? <KurikulumTabs /> : null;
}
