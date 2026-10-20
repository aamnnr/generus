"use client";

import { useLinkStatus } from "next/link";
import { useAnyPending, useReportPending } from "./pending-store";

/** Bilah progres tipis di atas halaman selama navigasi berjalan. */
export function NavProgress() {
  const pending = useAnyPending();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden print:hidden">
      <div className={`nav-progress h-full bg-brass ${pending ? "is-active" : ""}`} />
    </div>
  );
}

/** Ditaruh di dalam <Link>: melaporkan status pending link itu ke bilah progres. */
export function LinkPendingSignal() {
  const { pending } = useLinkStatus();
  useReportPending(pending);
  return null;
}
