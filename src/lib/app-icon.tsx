import { ImageResponse } from "next/og";

// Ikon aplikasi dibuat dari kode (tanpa file desain). Ganti di sini bila
// organisasi punya logo resmi.

export const BRAND_COLOR = "#1A4A39";
export const APP_NAME = "Generus";

/**
 * @param size sisi ikon dalam piksel
 * @param maskable true untuk ikon "maskable" Android: isi di zona aman 80% tengah, latar penuh.
 */
export function appIcon(size: number, { maskable = false } = {}) {
  const radius = maskable ? 0 : Math.round(size * 0.22);
  // Kubah putih di atas hijau tua (DESIGN.md §5). Maskable: isi di zona aman 80% tengah.
  const glyph = Math.round(size * (maskable ? 0.5 : 0.62));
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
        <svg width={glyph} height={glyph} viewBox="0 0 64 64">
          <path
            fill="#FFFFFF"
            d="M32 10c-10 0-17 8.5-17 18.5V34h34v-5.5C49 18.5 42 10 32 10zM31 3h2v6h-2zM12 36h40v4H12zM16 42h32v16H16z"
          />
          <path fill={BRAND_COLOR} d="M28 46h8v12h-8z" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
