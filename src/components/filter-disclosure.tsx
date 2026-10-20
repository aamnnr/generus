"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

/** Filter tambahan: di HP disembunyikan di balik tombol, di desktop selalu tampil. */
export function FilterDisclosure({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-primary md:hidden"
      >
        <SlidersHorizontal className="size-[18px]" aria-hidden /> {label}
      </button>
      <div className={`${open ? "flex" : "hidden"} w-full flex-col gap-2 md:flex md:w-auto md:flex-row md:items-center`}>{children}</div>
    </>
  );
}
