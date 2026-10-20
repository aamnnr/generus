import type { CSSProperties } from "react";
import Link from "@/components/app-link";

/** Tab segmen berbentuk pil (DESIGN.md §7), berupa tautan. Pil aktif meluncur saat berpindah tab. */
export function SegmentNav({ label, items }: { label: string; items: { href: string; label: string; active: boolean }[] }) {
  const name = `seg-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const pill = { viewTransitionName: name, viewTransitionClass: "segment-pill" } as CSSProperties;
  return (
    <nav aria-label={label} className="flex w-full gap-1 overflow-x-auto rounded-full bg-muted p-1 [scrollbar-width:none] sm:w-fit">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          scroll={false}
          aria-current={i.active ? "page" : undefined}
          style={i.active ? pill : undefined}
          className={`flex h-9 flex-1 items-center justify-center rounded-full px-4 text-sm whitespace-nowrap sm:flex-none ${
            i.active ? "bg-card font-semibold text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
