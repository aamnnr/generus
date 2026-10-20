"use client";

import { useLayoutEffect, useRef } from "react";
import NextLink from "next/link";
import { useOptimisticNav } from "@/components/nav/use-optimistic-nav";

/**
 * Tab segmen berbentuk pil (DESIGN.md §7). Pil aktif meluncur seketika saat
 * diklik (optimistik); data halaman menyusul di latar.
 */
export function SegmentNav({ label, items }: { label: string; items: { href: string; label: string; active: boolean }[] }) {
  const { current, onClick } = useOptimisticNav(items.find((i) => i.active)?.href ?? null);
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  // Posisikan pil di bawah tab aktif; transisi CSS membuatnya meluncur.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill) return;
    const el = [...nav.querySelectorAll<HTMLElement>("[data-href]")].find((a) => a.dataset.href === current);
    if (!el) {
      pill.style.opacity = "0";
      return;
    }
    pill.style.width = `${el.offsetWidth}px`;
    pill.style.transform = `translateX(${el.offsetLeft}px)`;
    pill.style.opacity = "1";
    // Animasi baru aktif setelah posisi awal terpasang (tidak meluncur saat pertama tampil).
    const raf = requestAnimationFrame(() => pill.classList.add("segment-pill-ready"));
    return () => cancelAnimationFrame(raf);
  }, [current, items]);

  return (
    <nav
      ref={navRef}
      aria-label={label}
      className="relative flex w-full gap-1 overflow-x-auto rounded-full bg-muted p-1 [scrollbar-width:none] sm:w-fit"
    >
      <span ref={pillRef} aria-hidden className="segment-pill absolute top-1 bottom-1 left-0 rounded-full bg-card opacity-0 shadow-card" />
      {items.map((i) => {
        const on = i.href === current;
        return (
          <NextLink
            key={i.href}
            href={i.href}
            data-href={i.href}
            scroll={false}
            onClick={onClick(i.href)}
            aria-current={on ? "page" : undefined}
            className={`relative z-10 flex h-9 flex-1 items-center justify-center rounded-full px-4 text-sm whitespace-nowrap transition-colors duration-200 sm:flex-none ${
              on ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {i.label}
          </NextLink>
        );
      })}
    </nav>
  );
}

/** Deretan chip kategori (mis. jenjang): chip aktif berpindah seketika saat diklik. */
export function ChipNav({
  label,
  items,
  className,
}: {
  label: string;
  items: { href: string; label: string; active: boolean }[];
  className?: string;
}) {
  const { current, onClick } = useOptimisticNav(items.find((i) => i.active)?.href ?? null);
  return (
    <div role="group" aria-label={label} className={className}>
      {items.map((i) => {
        const on = i.href === current;
        return (
          <NextLink
            key={i.label}
            href={i.href}
            scroll={false}
            onClick={onClick(i.href)}
            aria-current={on ? "true" : undefined}
            className={`flex h-9 shrink-0 items-center rounded-full border px-4 text-sm whitespace-nowrap transition-colors duration-200 ${
              on ? "border-primary bg-primary font-semibold text-primary-foreground" : "border-transparent bg-tile text-foreground hover:bg-secondary"
            }`}
          >
            {i.label}
          </NextLink>
        );
      })}
    </div>
  );
}
