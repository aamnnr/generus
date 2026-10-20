import { notFound } from "next/navigation";
import { appIcon } from "@/lib/app-icon";

// Ikon PNG untuk manifest PWA. Dibuat sekali saat build.

const ICONS: Record<string, { size: number; maskable?: boolean }> = {
  "icon-192.png": { size: 192 },
  "icon-512.png": { size: 512 },
  "maskable-192.png": { size: 192, maskable: true },
  "maskable-512.png": { size: 512, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(ICONS).map((file) => ({ file }));
}

export async function GET(_req: Request, { params }: RouteContext<"/icons/[file]">) {
  const icon = ICONS[(await params).file];
  if (!icon) notFound();
  return appIcon(icon.size, { maskable: icon.maskable });
}
