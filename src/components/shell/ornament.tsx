import { BrandTile } from "@/components/brand/logo";
import { isKliik } from "@/lib/brand";

// Ornamen & tanda merek (DESIGN.md §5). Selalu dekoratif: aria-hidden.
// Merek KLIIK JM: ornamen islami diganti motif centang dari ikon aplikasi (src/lib/brand.ts).

/** Centang besar bergaris (motif KLIIK JM) untuk watermark kartu hero, login, empty state. */
function CheckOrnament({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round">
      <path d="M48 64l34 32 72-76" />
    </svg>
  );
}

/** Siluet masjid garis sederhana untuk watermark kartu hero, login, empty state. */
export function MosqueSilhouette({ className }: { className?: string }) {
  if (isKliik) return <CheckOrnament className={className} />;
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden="true" fill="currentColor">
      <path d="M20 120V52l6-14 6 14v68zM168 120V52l6-14 6 14v68zM48 120V82h104v38zM100 20c-25 0-42 21-42 46v16h84V66c0-25-17-46-42-46zM98 4h4v14h-4z" />
    </svg>
  );
}

/** Tanda aplikasi: ikon KLIIK JM, atau logo lama di kotak hijau tua. */
export function BrandMark({ className }: { className?: string }) {
  if (isKliik) {
    // eslint-disable-next-line @next/next/no-img-element -- SVG statis kecil
    return <img src="/brand/kliik-jm-icon.svg" alt="" className={`rounded-xl ${className ?? "size-10"}`} />;
  }
  return <BrandTile className={className} />;
}

/** Ikon kartu info: bintang delapan (desain lama) atau lencana centang (KLIIK JM). */
export function EightStar({ className }: { className?: string }) {
  if (isKliik) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9.5" />
        <path d="m7.8 12.3 2.8 2.7 5.6-6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M12 2l2.6 3.7L19 5l-.7 4.4L22 12l-3.7 2.6L19 19l-4.4-.7L12 22l-2.6-3.7L5 19l.7-4.4L2 12l3.7-2.6L5 5l4.4.7z" />
    </svg>
  );
}
