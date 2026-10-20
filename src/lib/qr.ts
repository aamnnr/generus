// Isi QR kartu generus. Harus sama dengan app.qr_payload() di database.
export const QR_PREFIX = "GNR1:";

export function qrPayload(token: string): string {
  return `${QR_PREFIX}${token}`;
}

/** Normalisasi hasil scan / ketikan (scanner keyboard bisa menambah spasi atau huruf kecil). */
export function normalizeScanned(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  return /^GNR1:[0-9A-F]{16}$/.test(s) ? s : null;
}

/** SHA-256 hex, sama dengan token_hash dari app.agenda_roster(). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
