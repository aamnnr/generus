import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUp, BookOpenText, ChevronRight, Library, ScrollText, IdCard, KeyRound, LogOut, MapPin, Upload, UserCog, type LucideIcon } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { initials } from "@/components/shell/nav";
import { MosqueSilhouette } from "@/components/shell/ornament";
import { canEditCurriculum, canWriteGenerus, getCurrentUser, roleLabel } from "@/lib/auth";

export const metadata: Metadata = { title: "Lainnya · Generus" };

export default function LainnyaPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Lainnya</h1>
      <Suspense fallback={<p className="text-muted-foreground">Memuat…</p>}>
        <Menu />
      </Suspense>
    </>
  );
}

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  tag?: string;
}

async function Menu() {
  const me = await getCurrentUser({ allowPasswordChange: true });
  const writer = canWriteGenerus(me);
  const data: Item[] = writer
    ? [
        { href: "/generus/kartu", label: "Cetak kartu QR", icon: IdCard },
        { href: "/generus/kenaikan", label: "Kenaikan jenjang", icon: ArrowUp, tag: "Juli" },
        { href: "/generus/import", label: "Import dari Excel", icon: Upload },
      ]
    : [];
  const kurikulum: Item[] = [
    { href: "/kurikulum", label: "Target periode", icon: BookOpenText },
    ...(canEditCurriculum(me)
      ? [
          { href: "/kurikulum/materi", label: "Pustaka materi", icon: Library },
          { href: "/kurikulum/kitab", label: "Kitab", icon: ScrollText },
        ]
      : []),
  ];
  const admin: Item[] = me.isSuperadmin
    ? [
        { href: "/admin/wilayah", label: "Wilayah", icon: MapPin },
        { href: "/admin/akun", label: "Akun & peran", icon: UserCog },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <Link href="/akun/password" className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
        <span className="flex size-13 items-center justify-center rounded-full bg-secondary text-base font-bold text-secondary-foreground">
          {initials(me.name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-snug">
          <span className="font-bold">{me.name}</span>
          <span className="truncate text-[13px] text-muted-foreground">{me.email}</span>
          {me.roles.map((r) => (
            <span key={`${r.role}-${r.unitId}`} className="text-xs font-semibold text-primary">
              {roleLabel(r)} · {r.unitName}
            </span>
          ))}
        </span>
        <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
      </Link>

      {data.length > 0 && <Group title="DATA GENERUS" items={data} />}
      <Group title="KURIKULUM" items={kurikulum} />
      {admin.length > 0 && <Group title="ADMINISTRASI" items={admin} />}

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground">AKUN</h2>
        <ul className="overflow-hidden rounded-2xl bg-card shadow-card">
          <li className="border-b border-muted">
            <Row href="/akun/password" label="Ganti password" icon={KeyRound} />
          </li>
          <li>
            <form action={logout}>
              <button type="submit" className="flex h-14 w-full items-center gap-3 px-4 font-semibold text-destructive">
                <span className="flex size-9 items-center justify-center rounded-xl bg-status-alpa-soft">
                  <LogOut className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                Keluar
              </button>
            </form>
          </li>
        </ul>
      </section>

      <div className="relative overflow-hidden rounded-2xl bg-secondary p-4 text-center text-secondary-foreground">
        <MosqueSilhouette className="absolute -right-4 -bottom-3 w-36 opacity-15" />
        <p lang="ar" dir="rtl" className="font-arabic text-2xl leading-10 font-bold">
          بَارَكَ اللّٰهُ فِيْكُمْ
        </p>
        <p className="text-[13px]">Semoga Allah memberkahi kalian</p>
      </div>
    </div>
  );
}

function Group({ title, items }: { title: string; items: Item[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground">{title}</h2>
      <ul className="overflow-hidden rounded-2xl bg-card shadow-card">
        {items.map((i, n) => (
          <li key={i.href} className={n < items.length - 1 ? "border-b border-muted" : ""}>
            <Row {...i} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Row({ href, label, icon: Icon, tag }: Item) {
  return (
    <Link href={href} className="flex h-14 items-center gap-3 px-4 hover:bg-secondary/40">
      <span className="flex size-9 items-center justify-center rounded-xl bg-tile text-primary">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="flex-1 font-medium">{label}</span>
      {tag && <span className="text-xs font-semibold text-accent-foreground">{tag}</span>}
      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
    </Link>
  );
}
