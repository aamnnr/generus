"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useOffline } from "next/offline";
import { requestSync } from "@/components/outbox-sync";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { discardRejected, enqueue, offlineDb, retryRejected, type OutboxItem } from "@/lib/offline/outbox";

type Status = "hadir" | "terlambat" | "izin" | "sakit" | "alpa";

const OPTIONS: { value: Status; short: string; label: string; active: string }[] = [
  { value: "hadir", short: "H", label: "Hadir", active: "bg-status-hadir text-white border-status-hadir" },
  { value: "terlambat", short: "T", label: "Terlambat", active: "bg-status-terlambat text-white border-status-terlambat" },
  { value: "izin", short: "I", label: "Izin", active: "bg-status-izin text-white border-status-izin" },
  { value: "sakit", short: "S", label: "Sakit", active: "bg-status-sakit text-white border-status-sakit" },
  { value: "alpa", short: "A", label: "Alpa", active: "bg-status-alpa text-white border-status-alpa" },
];

export interface ChecklistRow {
  generusId: string;
  name: string;
  gender: "L" | "P";
  kelompok: string;
  desa: string;
  status: Status | null;
  canWrite: boolean;
}

/**
 * Checklist presensi offline-first: setiap ketukan langsung disimpan di
 * perangkat (antrian IndexedDB) lalu dikirim ke server di latar belakang.
 */
export function AttendanceChecklist({ agendaId, rows, showGroup }: { agendaId: string; rows: ChecklistRow[]; showGroup: boolean }) {
  const [query, setQuery] = useState("");
  const offline = useOffline();
  const queued = useLiveQuery(() => offlineDb().outbox.where("agendaId").equals(agendaId).toArray(), [agendaId]);
  const queuedMap = useMemo(() => new Map((queued ?? []).map((q) => [q.generusId, q])), [queued]);
  const waiting = (queued ?? []).filter((q) => !q.error).length;
  const rejected = (queued ?? []).filter((q): q is OutboxItem & { error: string } => !!q.error);

  const current = (r: ChecklistRow) => queuedMap.get(r.generusId)?.status ?? r.status;
  const writable = rows.filter((r) => r.canWrite);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const groups = useMemo(() => {
    const m = new Map<string, ChecklistRow[]>();
    for (const r of visible) {
      const key = showGroup ? `${r.kelompok} · Desa ${r.desa}` : "";
      m.set(key, [...(m.get(key) ?? []), r]);
    }
    return [...m];
  }, [visible, showGroup]);

  const record = async (entries: { generusId: string; status: Status }[]) => {
    if (entries.length === 0) return;
    await enqueue(entries.map((e) => ({ ...e, agendaId })));
    requestSync();
  };

  const markUnrecordedPresent = () =>
    record(writable.filter((r) => !current(r)).map((r) => ({ generusId: r.generusId, status: "hadir" as const })));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama" aria-label="Cari nama peserta" className="max-w-xs rounded-full" />
        {writable.some((r) => !current(r)) && (
          <Button type="button" variant="outline" size="sm" onClick={markUnrecordedPresent}>
            Hadirkan semua yang belum diisi
          </Button>
        )}
      </div>

      {rejected.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col gap-2">
            <span>
              {rejected.length} perubahan ditolak server: {rejected[0].error}
            </span>
            <span className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={async () => (await retryRejected(), requestSync())}>
                Coba lagi
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => discardRejected(agendaId)}>
                Buang perubahan ini
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-4">
        {groups.map(([group, items]) => (
          <section key={group} className="flex flex-col gap-1">
            {group && <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group}</h3>}
            <ul className="flex flex-col divide-y divide-muted overflow-hidden rounded-2xl bg-card shadow-card">
              {items.map((r) => {
                const value = current(r);
                const q = queuedMap.get(r.generusId);
                return (
                  <li key={r.generusId} className="flex flex-wrap items-center gap-2 px-3 py-2.5 md:px-4">
                    <span className="min-w-0 flex-1 text-sm">
                      {r.name} <span className="text-xs text-muted-foreground">({r.gender})</span>
                      {q && (
                        <span
                          className={`ml-2 inline-block size-2 rounded-full align-middle ${q.error ? "bg-status-alpa" : "bg-status-terlambat"}`}
                          title={q.error ? `Ditolak: ${q.error}` : "Tersimpan di perangkat, menunggu dikirim"}
                          aria-label={q.error ? "Ditolak server" : "Menunggu dikirim"}
                        />
                      )}
                    </span>
                    <div className="flex gap-1" role="radiogroup" aria-label={`Status ${r.name}`}>
                      {OPTIONS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          role="radio"
                          aria-checked={value === o.value}
                          aria-label={o.label}
                          title={o.label}
                          disabled={!r.canWrite}
                          onClick={() => value !== o.value && record([{ generusId: r.generusId, status: o.value }])}
                          className={`size-9 rounded-[10px] border text-[13px] font-bold transition-colors disabled:cursor-not-allowed min-[400px]:size-10 md:size-9 ${
                            value === o.value ? o.active : "border-border bg-card text-muted-foreground hover:bg-muted"
                          } ${!r.canWrite && value !== o.value ? "opacity-40" : ""}`}
                        >
                          {o.short}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {visible.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada peserta yang cocok.</p>}
      </div>

      {writable.length > 0 && (
        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-4 flex items-center gap-2 border-t border-border bg-background/95 px-4 py-3 text-sm backdrop-blur md:bottom-0 md:mx-0 md:rounded-2xl md:border-0 md:bg-card md:shadow-card lg:bottom-4">
          <span
            className={`inline-block size-2.5 rounded-full ${waiting === 0 ? "bg-status-hadir" : offline ? "bg-status-terlambat" : "bg-status-izin animate-pulse"}`}
            aria-hidden
          />
          <span role="status" className="text-muted-foreground">
            {waiting === 0
              ? "Semua perubahan tersimpan di server"
              : offline
                ? `${waiting} perubahan tersimpan di perangkat, dikirim otomatis saat online`
                : `Mengirim ${waiting} perubahan…`}
          </span>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        H = Hadir · T = Terlambat · I = Izin · S = Sakit · A = Alpa. Ketukan langsung tersimpan, juga saat sinyal putus.
      </p>
    </div>
  );
}
