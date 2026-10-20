"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TAB_TRANSITION } from "@/lib/transitions";
import { useReportPending } from "./pending-store";

/**
 * Navigasi kategori/tab yang terasa langsung: status aktif berpindah seketika
 * (optimistik) sementara data halaman diambil di latar.
 */
export function useOptimisticNav(activeHref: string | null) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(activeHref);
  useReportPending(pending);

  const go = (href: string) =>
    startTransition(() => {
      setCurrent(href);
      router.push(href, { scroll: false, transitionTypes: [TAB_TRANSITION] });
    });

  /** onClick untuk <a>: klik biasa ditangani di sini; ctrl/cmd/tengah tetap perilaku browser. */
  const onClick = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(href);
  };

  return { current, pending, go, onClick };
}
