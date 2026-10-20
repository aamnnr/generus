import { normalizeScanned, sha256Hex } from "@/lib/qr";
import { enqueue, offlineDb, outboxKey, type AttendanceStatus, type RosterItem } from "./outbox";

// Logika pemindai, sepenuhnya di perangkat: cocokkan hash QR dengan roster
// yang sudah diunduh, lalu masukkan ke antrian presensi. Bekerja tanpa sinyal.

export type ScanResult =
  | { kind: "ok"; name: string; kelompok: string; status: AttendanceStatus }
  | { kind: "duplicate"; name: string; kelompok: string; status: AttendanceStatus }
  | { kind: "unknown" }
  | { kind: "invalid" }
  | { kind: "closed"; reason: string };

/** Status terbaru seorang peserta: antrian lokal menang atas data unduhan. */
export async function currentStatus(item: RosterItem): Promise<AttendanceStatus | null> {
  const queued = await offlineDb().outbox.get(outboxKey(item.agendaId, item.generusId));
  return queued?.status ?? item.status;
}

async function agendaOpen(agendaId: string): Promise<{ lateAfter: Date } | { reason: string }> {
  const a = await offlineDb().scanAgendas.get(agendaId);
  if (!a) return { reason: "Daftar peserta belum diunduh. Buka pemindai saat online sekali." };
  if (a.cancelledAt) return { reason: "Agenda dibatalkan." };
  if (a.lockedAt) return { reason: "Presensi agenda sudah dikunci." };
  return { lateAfter: new Date(a.lateAfter) };
}

async function record(item: RosterItem, mode: "scan" | "search", now: Date, lateAfter: Date): Promise<ScanResult> {
  const existing = await currentStatus(item);
  if (existing) return { kind: "duplicate", name: item.name, kelompok: item.kelompok, status: existing };
  const status: AttendanceStatus = now > lateAfter ? "terlambat" : "hadir";
  await enqueue([{ agendaId: item.agendaId, generusId: item.generusId, status, mode }]);
  // Catat juga di roster lokal: setelah antrian terkirim & dihapus, scan ulang tetap terdeteksi duplikat.
  await offlineDb().roster.update([item.agendaId, item.generusId], { status });
  return { kind: "ok", name: item.name, kelompok: item.kelompok, status };
}

/** Proses satu hasil scan kamera / ketikan scanner keyboard. */
export async function processScan(agendaId: string, raw: string, now = new Date()): Promise<ScanResult> {
  const open = await agendaOpen(agendaId);
  if ("reason" in open) return { kind: "closed", reason: open.reason };
  const payload = normalizeScanned(raw);
  if (!payload) return { kind: "invalid" };
  const hash = await sha256Hex(payload);
  const item = await offlineDb().roster.where("[agendaId+tokenHash]").equals([agendaId, hash]).first();
  if (!item) return { kind: "unknown" };
  return record(item, "scan", now, open.lateAfter);
}

/** Cadangan tanpa kartu: catat lewat pencarian nama. */
export async function recordBySearch(agendaId: string, generusId: string, now = new Date()): Promise<ScanResult> {
  const open = await agendaOpen(agendaId);
  if ("reason" in open) return { kind: "closed", reason: open.reason };
  const item = await offlineDb().roster.get([agendaId, generusId]);
  if (!item) return { kind: "unknown" };
  return record(item, "search", now, open.lateAfter);
}
