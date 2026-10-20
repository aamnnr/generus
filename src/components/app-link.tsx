import NextLink from "next/link";
import type { ComponentProps } from "react";

/** Jenis transisi navigasi di dalam aplikasi; memicu crossfade halaman (lihat (app)/layout.tsx). */
export const PAGE_TRANSITION = "page";

/** `next/link` yang menandai navigasi sebagai perpindahan halaman agar dianimasikan halus. */
export default function Link({ transitionTypes = [PAGE_TRANSITION], ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink transitionTypes={transitionTypes} {...props} />;
}
