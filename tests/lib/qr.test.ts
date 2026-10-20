import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ZXING_WASM_SHA256 } from "barcode-detector/ponyfill";
import { normalizeScanned, qrPayload, sha256Hex } from "@/lib/qr";

describe("isi QR", () => {
  it("menormalkan hasil scan / ketikan scanner keyboard", () => {
    expect(normalizeScanned("  gnr1:abcdef0123456789 \n")).toBe("GNR1:ABCDEF0123456789");
    expect(normalizeScanned("https://contoh.com")).toBeNull();
    expect(normalizeScanned("GNR1:XYZ")).toBeNull();
  });

  it("hash di perangkat sama dengan hash dari database", async () => {
    const payload = qrPayload("ABCDEF0123456789");
    expect(await sha256Hex(payload)).toBe(createHash("sha256").update(payload).digest("hex"));
  });
});

describe("kartu → pemindai (ujung ke ujung)", () => {
  it("QR yang dicetak terbaca oleh pembaca WASM lokal dan hash-nya cocok dengan roster", async () => {
    // API browser yang dipakai ponyfill tapi tidak ada di Node.
    globalThis.DOMRectReadOnly ??= class {
      constructor(public x = 0, public y = 0, public width = 0, public height = 0) {}
      get top() { return this.y; }
      get left() { return this.x; }
      get right() { return this.x + this.width; }
      get bottom() { return this.y + this.height; }
      static fromRect(r: { x?: number; y?: number; width?: number; height?: number } = {}) {
        return new this(r.x, r.y, r.width, r.height);
      }
      toJSON() { return { ...this }; }
    } as unknown as typeof DOMRectReadOnly;
    const { default: QRCode } = await import("qrcode");
    const { BarcodeDetector, setZXingModuleOverrides } = await import("barcode-detector/ponyfill");
    const wasm = readFileSync(path.resolve(__dirname, "../../public/vendor/zxing_reader.wasm"));
    setZXingModuleOverrides({ wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) });

    const payload = qrPayload("852759605A3543C3");
    const png = await QRCode.toBuffer(payload, { errorCorrectionLevel: "M", margin: 2, scale: 6 });
    const [hit] = await new BarcodeDetector({ formats: ["qr_code"] }).detect(new Blob([new Uint8Array(png)], { type: "image/png" }));
    expect(hit.rawValue).toBe(payload);
    const scanned = normalizeScanned(hit.rawValue)!;
    expect(await sha256Hex(scanned)).toBe(createHash("sha256").update(payload).digest("hex"));
  }, 30_000);
});

describe("WASM pembaca QR", () => {
  it("salinan di public/vendor sama dengan versi barcode-detector terpasang (jalankan pnpm vendor:zxing bila gagal)", () => {
    const wasm = readFileSync(path.resolve(__dirname, "../../public/vendor/zxing_reader.wasm"));
    expect(createHash("sha256").update(wasm).digest("hex")).toBe(ZXING_WASM_SHA256);
  });
});
