"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { nameVariants } from "@/lib/name-abbrev";

/**
 * Nama di kartu (.idc-name, maks. 2 baris). Bila tidak muat, kata terakhir disingkat
 * menjadi huruf awal + titik sampai muat (lib/name-abbrev); elipsis CSS hanya cadangan.
 */
export function FitName({ name }: { name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(name);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const variants = nameVariants(name);
      // Ukur di salinan tersembunyi dengan kelas & lebar yang sama (DOM milik React tidak disentuh).
      const probe = el.cloneNode(false) as HTMLDivElement;
      Object.assign(probe.style, { position: "absolute", visibility: "hidden", width: `${el.clientWidth}px` });
      el.parentElement?.appendChild(probe);
      try {
        for (const v of variants) {
          probe.textContent = v;
          // line-clamp 2: teks yang terpotong membuat scrollHeight > clientHeight.
          if (probe.scrollHeight <= probe.clientHeight + 1) return setText(v);
        }
        setText(variants.at(-1)!);
      } finally {
        probe.remove();
      }
    };
    fit();
    // Ukur ulang setelah font Lora selesai dimuat (lebar huruf berubah).
    let cancelled = false;
    void document.fonts?.ready.then(() => !cancelled && fit());
    return () => {
      cancelled = true;
    };
  }, [name]);

  return (
    <div ref={ref} className="idc-name" title={name}>
      {text}
    </div>
  );
}
