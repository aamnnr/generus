"use client";

import { usePathname } from "next/navigation";
import { SegmentNav } from "@/components/segment-nav";

/** Tab bagian kurikulum; tab aktif mengikuti URL (layout tidak dirender ulang saat pindah). */
export function KurikulumTabs() {
  const pathname = usePathname();
  return (
    <SegmentNav
      label="Bagian kurikulum"
      items={[
        { href: "/kurikulum", label: "Periode target", active: pathname === "/kurikulum" },
        { href: "/kurikulum/materi", label: "Pustaka materi", active: pathname === "/kurikulum/materi" },
        { href: "/kurikulum/kitab", label: "Kitab", active: pathname === "/kurikulum/kitab" },
      ]}
    />
  );
}
