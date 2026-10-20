import { Suspense, ViewTransition } from "react";
import { PAGE_TRANSITION, TAB_TRANSITION } from "@/lib/transitions";
import { OutboxSync } from "@/components/outbox-sync";
import { BottomNav, Sidebar } from "@/components/shell/app-nav";
import { buildNav } from "@/components/shell/nav";
import { getCurrentUser } from "@/lib/auth";

// Kerangka aplikasi (DESIGN.md §6): menu samping di desktop, tab bawah di HP.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1">
      <OutboxSync />
      <Suspense fallback={<div className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block" />}>
        <ShellNav part="sidebar" />
      </Suspense>
      <main className="mx-auto flex w-full max-w-[1200px] min-w-0 flex-1 flex-col px-4 pt-5 pb-28 md:px-6 lg:px-8 lg:pt-7 lg:pb-12 print:p-0">
        {/* Pindah halaman = crossfade; ganti kategori/filter = hanya bagian yang berubah memudar; aksi/simpan tidak beranimasi. */}
        <ViewTransition update={{ [PAGE_TRANSITION]: "page-fade", [TAB_TRANSITION]: "tab-swap", default: "none" }} default="none">
          <div className="page-body flex flex-1 flex-col gap-5">{children}</div>
        </ViewTransition>
      </main>
      <Suspense>
        <ShellNav part="tabs" />
      </Suspense>
    </div>
  );
}

async function ShellNav({ part }: { part: "sidebar" | "tabs" }) {
  const nav = buildNav(await getCurrentUser({ allowPasswordChange: true }));
  return part === "sidebar" ? <Sidebar nav={nav} /> : <BottomNav nav={nav} />;
}
