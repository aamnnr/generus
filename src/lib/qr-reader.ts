// Pembaca QR dari kamera. Memakai BarcodeDetector bawaan browser bila ada
// (Chrome Android), selain itu ponyfill zxing-wasm dengan WASM lokal
// (/vendor/zxing_reader.wasm) agar tetap jalan offline, termasuk di iPhone.

export interface QrDetector {
  detect(source: HTMLVideoElement): Promise<string[]>;
}

export async function createQrDetector(): Promise<QrDetector> {
  const Native = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): { detect(s: unknown): Promise<{ rawValue: string }[]> }; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
  if (Native && (await Native.getSupportedFormats?.())?.includes("qr_code")) {
    const d = new Native({ formats: ["qr_code"] });
    return { detect: async (v) => (await d.detect(v)).map((b) => b.rawValue) };
  }
  const { BarcodeDetector, setZXingModuleOverrides } = await import("barcode-detector/ponyfill");
  setZXingModuleOverrides({
    locateFile: (file: string, prefix: string) => (file.endsWith(".wasm") ? "/vendor/zxing_reader.wasm" : prefix + file),
  });
  const d = new BarcodeDetector({ formats: ["qr_code"] });
  return { detect: async (v) => (await d.detect(v)).map((b) => b.rawValue) };
}

/** Bunyi pendek lewat WebAudio (tanpa file audio). */
export function beep(kind: "ok" | "warn" | "error") {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = (beep as { ctx?: AudioContext }).ctx ?? ((beep as { ctx?: AudioContext }).ctx = new Ctx());
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = kind === "ok" ? 880 : kind === "warn" ? 520 : 220;
    osc.type = kind === "error" ? "square" : "sine";
    gain.gain.value = 0.15;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (kind === "ok" ? 0.12 : 0.3));
  } catch {
    // Audio tidak tersedia: abaikan.
  }
  navigator.vibrate?.(kind === "ok" ? 80 : [60, 60, 60]);
}
