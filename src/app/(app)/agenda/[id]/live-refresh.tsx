"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Perbarui data halaman (ringkasan presensi) secara berkala selama agenda
 * berlangsung, agar hasil pemindai QR dari petugas lain langsung terlihat.
 * Berhenti saat tab tidak terlihat dan langsung diperbarui saat kembali.
 */
export function LiveRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [at, setAt] = useState<Date | null>(null);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      startTransition(() => router.refresh());
      setAt(new Date());
    };
    const timer = setInterval(refresh, seconds * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, seconds]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="relative inline-flex size-2" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-hadir opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-status-hadir" />
      </span>
      Langsung · diperbarui tiap {seconds} detik
      {at && ` (terakhir ${at.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })})`}
    </span>
  );
}
