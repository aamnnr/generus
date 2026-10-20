import NextLink from "next/link";
import type { ComponentProps } from "react";
import { LinkPendingSignal } from "@/components/nav/nav-progress";
import { PAGE_TRANSITION } from "@/lib/transitions";

/**
 * `next/link` yang menandai navigasi sebagai pindah halaman (crossfade) dan
 * menyalakan bilah progres selama halaman tujuan dimuat. Untuk ganti
 * kategori/tab di halaman yang sama, kirim `transitionTypes={[TAB_TRANSITION]}`
 * atau pakai SegmentNav/ChipNav.
 */
export default function Link({ transitionTypes = [PAGE_TRANSITION], children, ...props }: ComponentProps<typeof NextLink>) {
  return (
    <NextLink transitionTypes={transitionTypes} {...props}>
      {children}
      <LinkPendingSignal />
    </NextLink>
  );
}
