"use client";

import { useEffect } from "react";
import { useOffline } from "next/offline";

/**
 * Mendaftarkan service worker (hanya build produksi, agar kode dev tidak
 * tersangkut di cache) dan menampilkan banner saat offline.
 */
export function Pwa() {
  const offline = useOffline();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Gagal mendaftar tidak menghalangi aplikasi; hanya fitur offline yang hilang.
    });
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-50 bg-amber-100 print:hidden px-4 py-2 text-center text-sm text-amber-950 dark:bg-amber-900 dark:text-amber-50"
    >
      Anda sedang offline. Perubahan akan dikirim otomatis saat koneksi kembali.
    </div>
  );
}
