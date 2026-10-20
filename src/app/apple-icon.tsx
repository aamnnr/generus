import { appIcon } from "@/lib/app-icon";

// iOS membulatkan sudut sendiri, jadi pakai latar penuh.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIcon(180, { maskable: true });
}
