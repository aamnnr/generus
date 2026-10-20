import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MosqueSilhouette } from "@/components/shell/ornament";

// Pola halaman bersama (DESIGN.md §7): tautan kembali, judul + aksi, keadaan kosong.

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="-my-2 -ml-2 flex h-11 w-fit items-center gap-1 rounded-xl pr-3 pl-1 text-sm font-medium text-muted-foreground hover:text-foreground print:hidden"
    >
      <ChevronLeft className="size-5" aria-hidden />
      {children}
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  badges,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3 print:hidden">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl leading-8 font-bold md:text-[26px] md:leading-[34px]">{title}</h1>
          {badges}
        </div>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-10 text-center shadow-card">
      <MosqueSilhouette className="w-24 text-brass opacity-40" />
      <p className="text-lg font-bold">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

/** Badge pil kecil: aksen (tingkat), sukses, bahaya, netral. */
export function Pill({ tone = "accent", children }: { tone?: "accent" | "ok" | "danger" | "muted"; children: React.ReactNode }) {
  const cls = {
    accent: "bg-accent text-accent-foreground",
    ok: "bg-status-hadir-soft text-status-hadir",
    danger: "bg-status-alpa-soft text-status-alpa",
    muted: "bg-muted text-muted-foreground",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${cls}`}>{children}</span>;
}
