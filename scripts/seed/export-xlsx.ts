/**
 * Membuat file template berisi data contoh untuk menguji import Excel.
 *
 *   pnpm seed:xlsx [jumlah=100] [--with-errors] [--out=path.xlsx]
 *
 * Wilayah mengikuti data seed (desa Sukamaju, dst.), tetapi generusnya dibuat
 * dengan benih berbeda sehingga tidak dianggap duplikat saat diimport.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { generateSeedData } from "./generate";

const args = process.argv.slice(2);
const count = Number(args.find((a) => /^\d+$/.test(a)) ?? 100);
const withErrors = args.includes("--with-errors");
const out = args.find((a) => a.startsWith("--out="))?.slice(6) ?? `contoh-import-${count}.xlsx`;

export function buildImportWorkbook(n: number, opts: { withErrors?: boolean; seed?: number } = {}): XLSX.WorkBook {
  const template = readFileSync(path.resolve(__dirname, "../../public/templates/Template_Data_Generus.xlsx"));
  const wb = XLSX.read(template, { type: "buffer" });
  const data = generateSeedData({
    seed: opts.seed ?? 777,
    desaCount: 2,
    kelompokPerDesa: 3,
    // Lebihkan (jumlah per kelompok diacak ±30%) lalu potong tepat n baris.
    generusPerKelompok: Math.ceil(n / 6 / 0.7) + 1,
  });

  const wilayah = data.desa.flatMap((d) => d.kelompok.map((k) => [d.name, k.name]));
  XLSX.utils.sheet_add_aoa(wb.Sheets.Wilayah, wilayah, { origin: "A3" });

  const toSerial = (iso: string) => (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000;
  const rows = data.desa
    .flatMap((d) => d.kelompok.flatMap((k) => k.generus.map((g) => ({ g, kode: `${d.name} / ${k.name}` }))))
    .slice(0, n)
    .map(({ g, kode }, i) => [
      i + 1, g.name, g.gender, toSerial(g.birthDate), kode, g.jenjang, g.kategori, g.school, g.guardianName, g.guardianPhone, null,
    ]);
  if (opts.withErrors) {
    rows.push(
      [rows.length + 1, "Baris Tanpa Kategori", "L", toSerial("2008-01-01"), wilayah[0].join(" / "), "Remaja", null, null, null, null, null],
      [rows.length + 2, "Baris Kelompok Salah", "P", toSerial("2012-01-01"), "Desa Antah / Berantah", "Pra Remaja", null, null, null, null, null],
      [rows.length + 3, "Baris Tanggal Salah", "P", "31/02/2012", wilayah[0].join(" / "), "Pra Remaja", null, null, null, null, null],
      rows[0].slice(),
    );
  }
  XLSX.utils.sheet_add_aoa(wb.Sheets.Generus, rows, { origin: "A3" });
  return wb;
}

if (require.main === module) {
  const wb = buildImportWorkbook(count, { withErrors });
  writeFileSync(out, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  console.log(`✓ ${out} (${count} generus${withErrors ? " + 4 baris bermasalah/duplikat" : ""})`);
}
