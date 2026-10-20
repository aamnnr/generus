import Link from "next/link";

/** Tab segmen berbentuk pil (DESIGN.md §7), berupa tautan. */
export function SegmentNav({ label, items }: { label: string; items: { href: string; label: string; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="flex w-full gap-1 overflow-x-auto rounded-full bg-muted p-1 [scrollbar-width:none] sm:w-fit">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.active ? "page" : undefined}
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
