// Ornamen & tanda merek (DESIGN.md §5). Selalu dekoratif: aria-hidden.

/** Siluet masjid garis sederhana untuk watermark kartu hero, login, empty state. */
export function MosqueSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden="true" fill="currentColor">
      <path d="M20 120V52l6-14 6 14v68zM168 120V52l6-14 6 14v68zM48 120V82h104v38zM100 20c-25 0-42 21-42 46v16h84V66c0-25-17-46-42-46zM98 4h4v14h-4z" />
    </svg>
  );
}

/** Tanda aplikasi: kubah putih di kotak hijau tua. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={`flex items-center justify-center rounded-xl bg-hero text-hero-foreground ${className ?? "size-10"}`}>
      <svg viewBox="0 0 64 64" className="size-[65%]" aria-hidden="true" fill="currentColor">
        <path d="M32 10c-10 0-17 8.5-17 18.5V34h34v-5.5C49 18.5 42 10 32 10zM31 3h2v6h-2zM12 36h40v4H12zM16 42h32v16H16z" />
      </svg>
    </span>
  );
}

/** Bintang delapan (pola geometri Islami) untuk kartu info. */
export function EightStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M12 2l2.6 3.7L19 5l-.7 4.4L22 12l-3.7 2.6L19 19l-4.4-.7L12 22l-2.6-3.7L5 19l.7-4.4L2 12l3.7-2.6L5 5l4.4.7z" />
    </svg>
  );
}
