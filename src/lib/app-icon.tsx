import { ImageResponse } from "next/og";

// Ikon aplikasi dibuat dari kode (tanpa file desain). Ganti di sini bila
// organisasi punya logo resmi.

export const BRAND_COLOR = "#0f766e";
export const APP_NAME = "Generus";

/**
 * @param size sisi ikon dalam piksel
 * @param maskable true untuk ikon "maskable" Android: isi di zona aman 80% tengah, latar penuh.
 */
export function appIcon(size: number, { maskable = false } = {}) {
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const fontSize = Math.round(size * (maskable ? 0.46 : 0.6));
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
          color: "white",
          fontSize,
          fontWeight: 700,
          letterSpacing: -fontSize * 0.04,
        }}
      >
        G
      </div>
    ),
    { width: size, height: size },
  );
}
