// Penahan scan berulang & penggabung riwayat untuk pemindai kamera.
//
// Kamera membaca QR yang sama beberapa kali per detik selama kartu masih di depan
// lensa. Praktik umum di pemindai kasir/tiket: satu kode hanya diproses sekali
// selama kode itu TERUS terlihat; kode yang sama baru diterima lagi setelah
// kartu disingkirkan beberapa saat. Jadi jedanya dihitung dari terakhir kali
// kode itu TERLIHAT (bergeser), bukan dari scan pertama — kartu yang ditahan
// 10 detik tetap dihitung sekali.

export const SAME_CODE_RELEASE_MS = 1500;

export interface ScanGate {
  /** True bila kode ini perlu diproses; false bila masih pengulangan kartu yang sama. */
  accept(code: string, now?: number): boolean;
}

export function createScanGate(releaseMs = SAME_CODE_RELEASE_MS): ScanGate {
  const lastSeen = new Map<string, number>();
  return {
    accept(code, now = Date.now()) {
      const prev = lastSeen.get(code);
      lastSeen.set(code, now);
      // Bersihkan kode lama agar Map tidak tumbuh selama acara panjang.
      if (lastSeen.size > 200) for (const [k, t] of lastSeen) if (now - t > releaseMs) lastSeen.delete(k);
      return prev === undefined || now - prev >= releaseMs;
    },
  };
}

export interface LogEntry<T> {
  key: string;
  /** Yang ditampilkan di riwayat (bisa hasil pertama, lihat `keep`). */
  value: T;
  /** Hasil paling baru untuk kunci ini (untuk panel umpan balik). */
  last: T;
  /** Waktu pertama & terakhir muncul (ms). */
  firstAt: number;
  at: number;
  /** Berapa kali kunci ini muncul. */
  count: number;
}

/**
 * Tambahkan hasil ke riwayat. Hasil dengan kunci yang sama (orang yang sama, atau
 * pesan galat yang sama) tidak menambah baris: baris lamanya naik ke atas dengan
 * hitungan bertambah. `keep(prev, next)` = true mempertahankan nilai tampilan lama
 * (mis. "Hadir" tetap tampil walau scan berikutnya "sudah tercatat").
 */
export function pushLog<T>(
  log: LogEntry<T>[],
  key: string,
  value: T,
  at: number,
  opts: { limit?: number; keep?: (prev: T, next: T) => boolean } = {},
): LogEntry<T>[] {
  const old = log.find((e) => e.key === key);
  const entry: LogEntry<T> = {
    key,
    value: old && opts.keep?.(old.value, value) ? old.value : value,
    last: value,
    firstAt: old?.firstAt ?? at,
    at,
    count: (old?.count ?? 0) + 1,
  };
  return [entry, ...log.filter((e) => e !== old)].slice(0, opts.limit ?? 50);
}
