import { Suspense } from "react";
import type { Metadata } from "next";
import { OutboxSync } from "@/components/outbox-sync";
import { Scanner } from "./scanner";

// Kerangka statis tanpa data pribadi: aman disimpan service worker sehingga
// pemindai bisa dibuka tanpa sinyal. Data peserta dibaca dari IndexedDB.
export const metadata: Metadata = { title: "Pemindai QR · Generus" };

export default function PindaiPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4">
      <OutboxSync />
      <Suspense fallback={<p className="text-muted-foreground">Memuat pemindai…</p>}>
        <Scanner />
      </Suspense>
    </main>
  );
}
