"use client";

import { useEffect, useSyncExternalStore } from "react";

// Jumlah navigasi yang sedang berjalan (link, tab, filter). Dipakai bilah
// progres di atas halaman agar pengguna langsung tahu klik sudah diterima.
let count = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useReportPending(pending: boolean) {
  useEffect(() => {
    if (!pending) return;
    count++;
    emit();
    return () => {
      count--;
      emit();
    };
  }, [pending]);
}

export function useAnyPending(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => count > 0,
    () => false,
  );
}
