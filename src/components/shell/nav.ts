import type { CurrentUser } from "@/lib/auth";
import { canReadGenerus, canWriteGenerus, rekapRootUnit, roleLabel } from "@/lib/auth";

// Struktur navigasi per peran (DESIGN.md §6.3). Dibangun di server, dirender
// oleh komponen klien yang hanya menandai item aktif.

export type NavIcon = "home" | "agenda" | "generus" | "kartu" | "capaian" | "laporan" | "kurikulum" | "wilayah" | "akun" | "lainnya";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

export interface ShellNav {
  main: NavItem[];
  admin: NavItem[];
  /** Tab bawah HP: maksimal 4 item, selalu diakhiri "Lainnya". */
  tabs: NavItem[];
  user: { name: string; initials: string; role: string };
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function buildNav(user: CurrentUser): ShellNav {
  const read = canReadGenerus(user);
  const main: NavItem[] = [{ href: "/beranda", label: "Beranda", icon: "home" }];
  if (read) {
    main.push({ href: "/agenda", label: "Agenda", icon: "agenda" }, { href: "/generus", label: "Generus", icon: "generus" });
  }
  if (canWriteGenerus(user)) main.push({ href: "/generus/kartu", label: "Kartu QR", icon: "kartu" });
  if (read) main.push({ href: "/capaian", label: "Capaian", icon: "capaian" });
  else if (rekapRootUnit(user)) main.push({ href: "/capaian/rekap", label: "Rekap capaian", icon: "capaian" });
  main.push({ href: "/kurikulum", label: "Kurikulum", icon: "kurikulum" });
  if (read) main.push({ href: "/laporan", label: "Laporan", icon: "laporan" });

  const admin: NavItem[] = user.isSuperadmin
    ? [
        { href: "/admin/wilayah", label: "Wilayah", icon: "wilayah" },
        { href: "/admin/akun", label: "Akun & peran", icon: "akun" },
      ]
    : [];

  const tabs = [...main.filter((i) => i.icon !== "kartu").slice(0, 3), { href: "/lainnya", label: "Lainnya", icon: "lainnya" as const }];
  const primaryRole = user.roles[0];
  return {
    main,
    admin,
    tabs,
    user: {
      name: user.name,
      initials: initials(user.name),
      role: primaryRole ? `${roleLabel(primaryRole)} · ${primaryRole.unitName}` : "Belum punya peran",
    },
  };
}
