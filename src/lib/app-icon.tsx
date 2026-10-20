import { ImageResponse } from "next/og";
import { LOGO_COLORS, LogoGlyph } from "@/components/brand/logo";

// Ikon aplikasi dibuat dari logo SVG (src/components/brand/logo.tsx).

export const BRAND_COLOR = LOGO_COLORS.green;
export const APP_NAME = "Generus";

/**
 * @param size sisi ikon dalam piksel
 * @param maskable true untuk ikon "maskable" Android: isi di zona aman 80% tengah, latar penuh.
 */
export function appIcon(size: number, { maskable = false } = {}) {
  const radius = maskable ? 0 : Math.round(size * 0.22);
  // Logo (varian ikon) di atas hijau tua (DESIGN.md §5). Maskable: isi di zona aman 80% tengah.
  const glyph = Math.round(size * (maskable ? 0.62 : 0.8));
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
