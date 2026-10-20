// Logo Generus (DESIGN.md §5): bintang delapan (rub el hizb) bergaris, di depannya
// masjid berkubah bawang dengan pintu mihrab terbuka. Varian "full" memakai bulan
// sabit di puncak kubah; varian "icon" tanpa sabit dan garis lebih tebal agar tetap
// terbaca di 16–48 px. Murni SVG tanpa hook: dipakai juga oleh next/og (ikon PWA).

export const LOGO_COLORS = {
  green: "#1A4A39",
  brass: "#C8A45C",
  cream: "#FBF8F1",
} as const;

const C = 50; // pusat bintang
const CY = 47;

/** 16 titik bintang delapan: ujung di R, lekuk di R·cos45°/cos22,5°. */
function starPoints(R: number): string {
  const r = (R * Math.SQRT1_2) / Math.cos(Math.PI / 8);
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    const d = i % 2 === 0 ? R : r;
    pts.push(`${(C + d * Math.cos(a)).toFixed(2)},${(CY + d * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

const STAR = starPoints(44);

// Kubah bawang + badan; pintu mihrab berujung lancip dilubangi (evenodd).
const MOSQUE =
  "M50 22C52 29 59 33 65 38C71 43 71 51 67 56L69 56L69 92L31 92L31 56L33 56C29 51 29 43 35 38C41 33 48 29 50 22Z" +
  "M42.5 92L42.5 72C42.5 66.5 46 63 50 60C54 63 57.5 66.5 57.5 72L57.5 92Z";
const FINIAL = "M48.9 17.5h2.2v5.5h-2.2z";
const CRESCENT = "M51.6 8.2a4.3 4.3 0 1 0 0 7.6a3.4 3.4 0 1 1 0-7.6z";

export interface LogoGlyphProps {
  variant?: "full" | "icon";
  /** Warna garis bintang. */
  star?: string;
  /** Warna masjid (pintu selalu tembus ke latar). */
  mosque?: string;
  /** Id unik bila ada beberapa logo di satu halaman dengan bentuk berbeda. */
  id?: string;
  className?: string;
  size?: number;
  title?: string;
}

export function LogoGlyph({
  variant = "full",
  star = LOGO_COLORS.brass,
  mosque = LOGO_COLORS.green,
  id = "gnr-logo",
  className,
  size,
  title,
}: LogoGlyphProps) {
  const icon = variant === "icon";
  const maskId = `${id}-${variant}`;
  const strokeW = icon ? 7 : 5;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect x="0" y="0" width="100" height="100" fill="#fff" />
          {/* Celah di sekeliling masjid agar garis bintang tidak menempel. */}
          <path d={MOSQUE} fill="#000" stroke="#000" strokeWidth={icon ? 9 : 7} strokeLinejoin="round" />
          {!icon && <path d={CRESCENT} fill="#000" stroke="#000" strokeWidth={4} />}
        </mask>
      </defs>
      <polygon
        points={STAR}
        fill="none"
        stroke={star}
        strokeWidth={strokeW}
        strokeLinejoin="miter"
        mask={`url(#${maskId})`}
      />
      <path d={MOSQUE} fill={mosque} fillRule="evenodd" />
      {!icon && <path d={FINIAL} fill={mosque} />}
      {!icon && <path d={CRESCENT} fill={star} />}
    </svg>
  );
}

/** Tanda aplikasi: logo di kotak hijau tua (sidebar, ikon). */
export function BrandTile({ className, variant = "icon" }: { className?: string; variant?: "full" | "icon" }) {
  return (
    <span className={`flex items-center justify-center rounded-xl bg-hero ${className ?? "size-10"}`}>
      <LogoGlyph variant={variant} star={LOGO_COLORS.brass} mosque={LOGO_COLORS.cream} id="gnr-tile" className="size-[82%]" />
    </span>
  );
}
