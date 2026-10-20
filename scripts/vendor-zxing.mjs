// Salin WASM pembaca QR (zxing-wasm) ke public/vendor agar pemindai jalan offline
// dan tidak bergantung CDN. Jalankan ulang setelah memperbarui barcode-detector.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// Resolusi lewat barcode-detector agar versi zxing-wasm yang dipakai sama persis.
const fromBarcode = createRequire(createRequire(import.meta.url).resolve("barcode-detector"));
let dir = path.dirname(fromBarcode.resolve("zxing-wasm/reader"));
while (path.basename(dir) !== "zxing-wasm" && dir !== path.dirname(dir)) dir = path.dirname(dir);
const src = path.join(dir, "dist/reader/zxing_reader.wasm");
if (!existsSync(src)) throw new Error(`WASM tidak ditemukan: ${src}`);
mkdirSync("public/vendor", { recursive: true });
copyFileSync(src, "public/vendor/zxing_reader.wasm");
console.log(`✓ ${path.relative(process.cwd(), src)} → public/vendor/zxing_reader.wasm`);
