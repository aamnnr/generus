"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveAttendance } from "@/app/(app)/agenda/actions";
import { flush, offlineDb } from "@/lib/offline/outbox";

// Mengirim antrian presensi di latar belakang: saat dimuat, saat kembali
// online, saat diminta (requestSync), dan berkala selama masih ada antrian.

const EVENT = "generus:outbox-sync";
const INTERVAL_MS = 20_000;

/** Minta pengiriman segera (mis. setelah mengetuk status). Digabung bila beruntun. */
export function requestSync() {
  window.dispatchEvent(new Event(EVENT));
}

export function OutboxSync() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const run = async () => {
      if (stopped || !("indexedDB" in window)) return;
      const pending = await offlineDb().outbox.filter((i) => !i.error).count();
      if (pending === 0) return;
      const res = await flush(saveAttendance);
      // Muat ulang data server agar ringkasan & status terbaru tampil.
      if (res.sent > 0) router.refresh();
    };
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void run().catch(() => {}), 800);
    };

    soon();
    const interval = setInterval(() => void run().catch(() => {}), INTERVAL_MS);
    window.addEventListener("online", soon);
    window.addEventListener(EVENT, soon);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("online", soon);
      window.removeEventListener(EVENT, soon);
    };
  }, [router]);

  return null;
}
