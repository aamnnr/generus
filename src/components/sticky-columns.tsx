"use client";

import { useEffect, useRef } from "react";

/**
 * Grid berkolom (mis. isi utama + kolom samping). Kolom tidak direnggangkan setinggi
 * kolom terpanjang (tanpa blok kosong). Saat kolom-kolom bersebelahan, kolom yang lebih
 * pendek menempel (sticky) ketika kolom terpanjang di-scroll:
 * - muat di layar → menempel di atas;
 * - lebih tinggi dari layar → ikut ter-scroll sampai ujung bawahnya terlihat, lalu menempel,
 *   sehingga seluruh isinya tetap bisa dijangkau.
 * Saat kolom bertumpuk (HP) tidak ada efek. Anak langsung = satu kolom.
 */
export function StickyColumns({ className = "", children, gap = 16 }: { className?: string; children: React.ReactNode; gap?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    let frame = 0;

    const update = () => {
      const cols = [...grid.children] as HTMLElement[];
      for (const c of cols) {
        c.style.position = "";
        c.style.top = "";
      }
      if (cols.length < 2) return;
      const tops = cols.map((c) => c.offsetTop);
      if (!tops.every((t) => Math.abs(t - tops[0]) < 2)) return; // bertumpuk: biarkan
      const heights = cols.map((c) => c.offsetHeight);
      const tallest = Math.max(...heights);
      cols.forEach((c, i) => {
        if (heights[i] >= tallest - 1) return;
        c.style.position = "sticky";
        c.style.top = `${Math.min(gap, window.innerHeight - heights[i] - gap)}px`;
      });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    // Isi kolom bisa berubah (form, daftar yang dimuat, dll.): ukur ulang.
    const ro = new ResizeObserver(schedule);
    ro.observe(grid);
    for (const c of grid.children) ro.observe(c);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [gap]);

  return (
    <div ref={ref} className={`${className} items-start`}>
      {children}
    </div>
  );
}
