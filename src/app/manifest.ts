import type { MetadataRoute } from "next";
import { APP_NAME, BRAND_COLOR } from "@/lib/app-icon";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pantau Generus",
    short_name: APP_NAME,
    description: "Presensi pengajian, target materi bulanan, dan progres kitab generus.",
    lang: "id",
    start_url: "/beranda",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: BRAND_COLOR,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
