import { ImageResponse } from "next/og";
import { LOGO_COLORS, LogoGlyph } from "@/components/brand/logo";
import { KLIIK_APPLE_SVG, KLIIK_FAVICON_SVG, KLIIK_ICON_SVG, KLIIK_MASKABLE_SVG } from "@/components/brand/kliik-svg";
import { brand, isKliik } from "@/lib/brand";

// Ikon aplikasi (favicon, PWA, apple-touch) sesuai merek aktif (src/lib/brand.ts).

export const BRAND_COLOR = brand.color;
export const APP_NAME = brand.name;

const dataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

/**
 * @param size sisi ikon dalam piksel
 * @param maskable true untuk ikon "maskable" Android: isi di zona aman 80% tengah, latar penuh.
 * @param apple true untuk apple-touch-icon (latar penuh; iOS membulatkan sudut sendiri).
 */
export function appIcon(size: number, { maskable = false, apple = false } = {}) {
  if (isKliik) {
    // ≤ 64 px (favicon): versi latar navy & garis tebal agar tetap terbaca.
    const svg = apple ? KLIIK_APPLE_SVG : maskable ? KLIIK_MASKABLE_SVG : size <= 64 ? KLIIK_FAVICON_SVG : KLIIK_ICON_SVG;
    return new ImageResponse(
      (
        // eslint-disable-next-line @next/next/no-img-element -- next/og merender <img>, bukan next/image
        <img src={dataUri(svg)} width={size} height={size} alt="" />
      ),
      { width: size, height: size },
    );
  }

  const full = maskable || apple;
  const radius = full ? 0 : Math.round(size * 0.22);
  // Logo (varian ikon) di atas hijau tua (DESIGN.md §5). Maskable: isi di zona aman 80% tengah.
  const glyph = Math.round(size * (full ? 0.62 : 0.8));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_COLOR,
          borderRadius: radius,
        }}
      >
        <LogoGlyph variant="icon" size={glyph} mosque={LOGO_COLORS.cream} id="app-icon" />
      </div>
    ),
    { width: size, height: size },
  );
}
