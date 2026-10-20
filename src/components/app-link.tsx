import NextLink from "next/link";
import type { ComponentProps } from "react";
import { PAGE_TRANSITION } from "@/lib/transitions";

/**
 * `next/link` yang menandai navigasi sebagai pindah halaman (crossfade).
 * Untuk ganti kategori/tab/filter di halaman yang sama, kirim
 * `transitionTypes={[TAB_TRANSITION]}` (lihat SegmentNav).
 */
export default function Link({ transitionTypes = [PAGE_TRANSITION], ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink transitionTypes={transitionTypes} {...props} />;
}
