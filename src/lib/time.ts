// Waktu agenda diinput & ditampilkan dalam zona waktu daerah (default WIB),
// disimpan sebagai timestamptz (UTC). Indonesia tidak memakai DST.

export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Jakarta";

function offsetMs(instant: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - instant.getTime();
}

/** "2026-10-25" + "19:30" di zona daerah → Date (UTC). */
export function zonedToUtc(date: string, time: string, timeZone = APP_TIMEZONE): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  return new Date(guess - offsetMs(new Date(guess), timeZone));
}

/** Date → { date: "YYYY-MM-DD", time: "HH:MM" } di zona daerah (untuk mengisi form). */
export function utcToZoned(instant: Date, timeZone = APP_TIMEZONE): { date: string; time: string } {
  const local = new Date(instant.getTime() + offsetMs(instant, timeZone));
  const iso = local.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

export function formatDateLong(d: Date, timeZone = APP_TIMEZONE): string {
  return d.toLocaleDateString("id-ID", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function formatTime(d: Date, timeZone = APP_TIMEZONE): string {
  return d.toLocaleTimeString("id-ID", { timeZone, hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(d: Date, timeZone = APP_TIMEZONE): string {
  return `${d.toLocaleDateString("id-ID", { timeZone, day: "numeric", month: "short", year: "numeric" })} ${formatTime(d, timeZone)}`;
}

/** Singkatan zona untuk label, mis. "WIB". */
export function zoneLabel(timeZone = APP_TIMEZONE): string {
  return { "Asia/Jakarta": "WIB", "Asia/Pontianak": "WIB", "Asia/Makassar": "WITA", "Asia/Jayapura": "WIT" }[timeZone] ?? timeZone;
}
