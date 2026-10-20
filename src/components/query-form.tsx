"use client";

import { useTransition, type ComponentProps } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useReportPending } from "@/components/nav/pending-store";
import { TAB_TRANSITION } from "@/lib/transitions";

/**
 * Form GET untuk filter/pencarian: berpindah lewat router (tanpa muat ulang
 * halaman) dengan transisi halus. Tanpa JavaScript tetap bekerja sebagai form biasa.
 */
export function QueryForm({ action, onSubmit, ...props }: Omit<ComponentProps<"form">, "action" | "method"> & { action?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const target = action ?? pathname;
  const [pending, startTransition] = useTransition();
  useReportPending(pending);
  return (
    <form
      {...props}
      aria-busy={pending || undefined}
      action={target}
      method="get"
      onSubmit={(e) => {
        onSubmit?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        const params = new URLSearchParams();
        for (const [k, v] of new FormData(e.currentTarget)) {
          if (typeof v === "string" && v !== "") params.append(k, v);
        }
        const qs = params.toString();
        startTransition(() => router.push(qs ? `${target}?${qs}` : target, { scroll: false, transitionTypes: [TAB_TRANSITION] }));
      }}
    />
  );
}
