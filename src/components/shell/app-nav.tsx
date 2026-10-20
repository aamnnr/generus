"use client";

import Link from "@/components/app-link";
import { usePathname } from "next/navigation";
import { BookOpenText, CalendarDays, ChartNoAxesColumn, FileBarChart, House, IdCard, LayoutGrid, LogOut, MapPin, UserCog, Users, type LucideIcon } from "lucide-react";
import { logout } from "@/app/actions/auth";
import type { NavIcon, NavItem, ShellNav } from "./nav";
import { BrandMark } from "./ornament";

const ICONS: Record<NavIcon, LucideIcon> = {
  kurikulum: BookOpenText,
  capaian: ChartNoAxesColumn,
  laporan: FileBarChart,
  home: House,
  agenda: CalendarDays,
  generus: Users,
  kartu: IdCard,
  wilayah: MapPin,
  akun: UserCog,
  lainnya: LayoutGrid,
};

/** Item aktif = href terpanjang yang menjadi awalan path saat ini. */
function useActiveHref(items: NavItem[]) {
  const path = usePathname();
  return items
    .filter((i) => path === i.href || path.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

/** Menu samping desktop (≥ 1024 px). */
export function Sidebar({ nav }: { nav: ShellNav }) {
  const active = useActiveHref([...nav.main, ...nav.admin]);
  const link = (item: NavItem) => {
    const Icon = ICONS[item.icon];
    const on = item.href === active;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={on ? "page" : undefined}
        className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors ${
          on ? "bg-secondary font-bold text-secondary-foreground" : "font-medium text-foreground hover:bg-secondary/60"
        }`}
      >
        <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
        {item.label}
      </Link>
    );
  };

  return (
    <aside style={{ viewTransitionName: "app-sidebar" }} className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 border-r border-sidebar-border bg-sidebar px-4 py-6 lg:flex print:hidden">
      <Link href="/beranda" className="mb-5 flex items-center gap-2.5 px-2">
        <BrandMark />
        <span className="font-heading text-[22px] font-semibold">Generus</span>
      </Link>
      <nav aria-label="Navigasi utama" className="flex flex-col gap-0.5">
        {nav.main.map(link)}
      </nav>
      {nav.admin.length > 0 && (
        <>
          <div className="mx-2 my-3 h-px bg-sidebar-border" />
          <div className="px-3 pb-1 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground">ADMINISTRASI</div>
          <nav aria-label="Administrasi" className="flex flex-col gap-0.5">
            {nav.admin.map(link)}
          </nav>
        </>
      )}
      <div className="mt-auto flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
        <Link href="/akun/password" className="flex min-w-0 flex-1 items-center gap-3" aria-label="Akun saya">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
            {nav.user.initials}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold">{nav.user.name}</span>
            <span className="truncate text-xs text-muted-foreground">{nav.user.role}</span>
          </span>
        </Link>
        <form action={logout}>
          <button type="submit" aria-label="Keluar" className="flex size-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
            <LogOut className="size-5" strokeWidth={1.75} aria-hidden />
          </button>
        </form>
      </div>
    </aside>
  );
}

/** Tab bawah HP & tablet (< 1024 px). */
export function BottomNav({ nav }: { nav: ShellNav }) {
  const active = useActiveHref(nav.tabs);
  return (
    <nav
      aria-label="Navigasi utama"
      style={{ viewTransitionName: "app-tabs" }}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_oklch(0.26_0.04_167/0.06)] backdrop-blur lg:hidden print:hidden"
    >
      <div className="mx-auto grid h-16 max-w-xl" style={{ gridTemplateColumns: `repeat(${nav.tabs.length}, minmax(0, 1fr))` }}>
        {nav.tabs.map((item) => {
          const Icon = ICONS[item.icon];
          const on = item.href === active;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-xs ${on ? "font-bold text-primary" : "font-medium text-muted-foreground"}`}
            >
              {on && <span className="absolute top-0 h-[3px] w-8 rounded-b bg-primary" aria-hidden />}
              <Icon className="size-6" strokeWidth={1.75} fill={on ? "var(--secondary)" : "none"} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
