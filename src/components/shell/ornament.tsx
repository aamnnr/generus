import { BrandTile } from "@/components/brand/logo";

// Ornamen & tanda merek (DESIGN.md §5). Selalu dekoratif: aria-hidden.

/** Siluet masjid garis sederhana untuk watermark kartu hero, login, empty state. */
export function MosqueSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden="true" fill="currentColor">
      <path d="M20 120V52l6-14 6 14v68zM168 120V52l6-14 6 14v68zM48 120V82h104v38zM100 20c-25 0-42 21-42 46v16h84V66c0-25-17-46-42-46zM98 4h4v14h-4z" />
    </svg>
  );
}

/** Tanda aplikasi: logo (varian ikon) di kotak hijau tua. */
export function BrandMark({ className }: { className?: string }) {
  return <BrandTile className={className} />;
}

/** Bintang delapan (pola geometri Islami) untuk kartu info. */
export function EightStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M12 2l2.6 3.7L19 5l-.7 4.4L22 12l-3.7 2.6L19 19l-4.4-.7L12 22l-2.6-3.7L5 19l.7-4.4L2 12l3.7-2.6L5 5l4.4.7z" />
    </svg>
  );
}
