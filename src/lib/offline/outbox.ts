import Dexie, { type EntityTable } from "dexie";

// Antrian presensi di perangkat (IndexedDB). Setiap ketukan status disimpan
// di sini dulu, lalu dikirim ke server; aman saat sinyal putus atau halaman
// ditutup. Kunci = agenda + generus, jadi ketukan terakhir menimpa yang lama
// dan pengiriman ulang idempoten (server melakukan upsert).

export type AttendanceStatus = "hadir" | "terlambat" | "izin" | "sakit" | "alpa";

export interface OutboxItem {
  key: string; // `${agendaId}:${generusId}`
  agendaId: string;
  generusId: string;
  status: AttendanceStatus;
  /** ms epoch; dipakai untuk tidak menghapus ketukan yang lebih baru dari yang terkirim. */
  updatedAt: number;
  attempts: number;
  /** Ditolak server (mis. di luar akses / batas waktu lewat); tidak dicoba ulang otomatis. */
  error?: string;
}

class OfflineDb extends Dexie {
  outbox!: EntityTable<OutboxItem, "key">;
  constructor(name = "generus") {
    super(name);
    this.version(1).stores({ outbox: "key, agendaId, updatedAt" });
  }
}

let db: OfflineDb | undefined;
export function offlineDb(): OfflineDb {
  db ??= new OfflineDb();
  return db;
}

export const outboxKey = (agendaId: string, generusId: string) => `${agendaId}:${generusId}`;

export async function enqueue(entries: { agendaId: string; generusId: string; status: AttendanceStatus }[]) {
  const now = Date.now();
  await offlineDb().outbox.bulkPut(
    entries.map((e) => ({ ...e, key: outboxKey(e.agendaId, e.generusId), updatedAt: now, attempts: 0 })),
  );
}

export type Sender = (input: {
  agendaId: string;
  entries: { generusId: string; status: AttendanceStatus }[];
}) => Promise<{ error?: string; saved?: number }>;

export interface FlushResult {
  sent: number;
  rejected: number;
  /** true bila pengiriman gagal karena jaringan (akan dicoba lagi). */
  offline: boolean;
}

let flushing: Promise<FlushResult> | null = null;

/**
 * Kirim semua item yang menunggu, per agenda. Hanya satu flush berjalan pada
 * satu waktu; pemanggil berikutnya menunggu flush yang sama.
 */
export function flush(send: Sender): Promise<FlushResult> {
  flushing ??= doFlush(send).finally(() => {
    flushing = null;
  });
  return flushing;
}

const BATCH = 500;

async function doFlush(send: Sender): Promise<FlushResult> {
  const table = offlineDb().outbox;
  const pending = (await table.toArray()).filter((i) => !i.error);
  const byAgenda = new Map<string, OutboxItem[]>();
  for (const i of pending) byAgenda.set(i.agendaId, [...(byAgenda.get(i.agendaId) ?? []), i]);

  const result: FlushResult = { sent: 0, rejected: 0, offline: false };
  for (const [agendaId, items] of byAgenda) {
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      let res: Awaited<ReturnType<Sender>>;
      try {
        res = await send({ agendaId, entries: batch.map((b) => ({ generusId: b.generusId, status: b.status })) });
        // Hanya respons yang jelas (saved berupa angka, atau error dari server) yang
        // dianggap final. Respons lain diperlakukan seperti gagal jaringan.
        if (!res || (typeof res.saved !== "number" && typeof res.error !== "string")) throw new Error("Respons tidak dikenal");
      } catch {
        // Jaringan putus / server tidak terjangkau: biarkan di antrian.
        await table.bulkPut(batch.map((b) => ({ ...b, attempts: b.attempts + 1 })));
        result.offline = true;
        return result;
      }
      await table.db.transaction("rw", table, async () => {
        for (const b of batch) {
          const latest = await table.get(b.key);
          if (!latest || latest.updatedAt !== b.updatedAt) continue; // ada ketukan baru; kirim di putaran berikut
          if (res.error) await table.put({ ...latest, attempts: latest.attempts + 1, error: res.error });
          else await table.delete(b.key);
        }
      });
      if (res.error) result.rejected += batch.length;
      else result.sent += batch.length;
    }
  }
  return result;
}

/** Hapus item yang ditolak server (pengguna memilih membuangnya). */
export async function discardRejected(agendaId?: string) {
  const table = offlineDb().outbox;
  const rejected = (await table.toArray()).filter((i) => i.error && (!agendaId || i.agendaId === agendaId));
  await table.bulkDelete(rejected.map((i) => i.key));
}

/** Coba lagi item yang ditolak (mis. setelah admin memperpanjang batas waktu). */
export async function retryRejected() {
  const table = offlineDb().outbox;
  const rejected = (await table.toArray()).filter((i) => i.error);
  await table.bulkPut(rejected.map((i) => ({ ...i, error: undefined, attempts: 0 })));
}
