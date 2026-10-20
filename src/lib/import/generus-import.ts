import * as XLSX from "xlsx";

// Membaca & memvalidasi file template (templates/Template_Data_Generus.xlsx).
// Murni (tanpa DB) supaya bisa dites; konteks lingkup user diberikan pemanggil.

export const MAX_IMPORT_ROWS = 3000;

export interface ImportContext {
  /** Kelompok yang boleh ditulis user: id, nama kelompok, nama desa. */
  kelompok: { id: string; name: string; desaName: string }[];
  /** Jenjang beserta kategorinya. */
  jenjang: { id: string; name: string; kategori: { id: string; name: string }[] }[];
  /** Kunci generus yang sudah ada: lihat `duplicateKey`. */
  existingKeys: Set<string>;
}

export interface GenerusInsert {
  kelompokId: string;
  name: string;
  gender: "L" | "P";
  birthDate: string;
  jenjangId: string;
  kategoriId: string | null;
  school: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  notes: string | null;
}

export interface ImportRow {
  /** Nomor baris di Excel (1-based), untuk ditunjukkan ke admin. */
  row: number;
  name: string;
  kelompok: string;
  jenjang: string;
  status: "ok" | "error" | "duplikat";
  message?: string;
  data?: GenerusInsert;
}

export interface ImportResult {
  rows: ImportRow[];
  /** Kesalahan tingkat file (sheet tidak ditemukan, terlalu banyak baris, dst.). */
  fileError?: string;
}

const COLUMNS = {
  name: ["nama lengkap", "nama"],
  gender: ["jenis kelamin", "l/p"],
  birthDate: ["tanggal lahir", "tgl lahir"],
  kelompok: ["kelompok"],
  jenjang: ["jenjang"],
  kategori: ["kategori"],
  school: ["sekolah / kelas", "sekolah/kelas", "sekolah"],
  guardianName: ["nama orang tua/wali", "orang tua/wali", "nama wali"],
  guardianPhone: ["no. hp orang tua/wali", "no hp orang tua/wali", "no. hp", "no hp"],
  notes: ["catatan"],
} as const;
type Column = keyof typeof COLUMNS;
const REQUIRED: Column[] = ["name", "gender", "birthDate", "kelompok", "jenjang"];

export const norm = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const normHeader = (v: unknown) => norm(v).replace(/\s*\*$/, "");

/** Kunci deteksi duplikat: kelompok + nama + tanggal lahir. */
export function duplicateKey(kelompokId: string, name: string, birthDate: string) {
  return `${kelompokId}|${norm(name)}|${birthDate}`;
}

/** Normalisasi No. HP; null bila kosong, undefined bila tidak valid. */
export function normalizePhone(v: unknown): string | null | undefined {
  if (v === null || v === undefined || v === "") return null;
  let s = String(v).replace(/[\s\-().]/g, "");
  if (typeof v === "number" && s.startsWith("8")) s = `0${s}`; // Excel membuang angka 0 di depan
  if (s.startsWith("62")) s = `+${s}`;
  return /^(\+62|0)8\d{7,12}$/.test(s) ? s : undefined;
}

/** Tanggal dari sel Excel (serial number, teks dd/mm/yyyy atau yyyy-mm-dd) → YYYY-MM-DD. */
export function parseDate(v: unknown): string | undefined {
  let y: number, m: number, d: number;
  if (typeof v === "number") {
    const p = XLSX.SSF.parse_date_code(v);
    if (!p) return undefined;
    ({ y, m, d } = p);
  } else {
    const s = String(v ?? "").trim();
    let match = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (match) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    else if ((match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    else return undefined;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return undefined;
  return date.toISOString().slice(0, 10);
}

function parseGender(v: unknown): "L" | "P" | undefined {
  const s = norm(v).replace(/[^a-z]/g, "");
  if (["l", "lk", "laki", "lakilaki"].includes(s)) return "L";
  if (["p", "pr", "perempuan", "wanita"].includes(s)) return "P";
  return undefined;
}

function buildKelompokIndex(kelompok: ImportContext["kelompok"]) {
  const strip = (s: string) => norm(s).replace(/^(desa|kelompok)\s+/, "");
  const full = new Map<string, string>();
  const byName = new Map<string, string[]>();
  for (const k of kelompok) {
    full.set(`${strip(k.desaName)}/${strip(k.name)}`, k.id);
    byName.set(strip(k.name), [...(byName.get(strip(k.name)) ?? []), k.id]);
  }
  return (input: unknown): string | "ambigu" | undefined => {
    const s = norm(input);
    if (s.includes("/")) {
      const [desa, kel] = s.split("/").map((x) => strip(x));
      return full.get(`${desa}/${kel}`);
    }
    const ids = byName.get(strip(s));
    if (!ids) return undefined;
    return ids.length === 1 ? ids[0] : "ambigu";
  };
}

const text = (v: unknown, max: number) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

/** Validasi baris-baris sheet Generus. `sheetRows` termasuk baris judul. */
export function validateRows(sheetRows: unknown[][], ctx: ImportContext): ImportResult {
  const headerIdx = sheetRows.findIndex((r) => r.some((c) => normHeader(c) === "nama lengkap"));
  if (headerIdx < 0) return { rows: [], fileError: "Kolom \"Nama Lengkap\" tidak ditemukan. Gunakan template resmi." };
  const header = sheetRows[headerIdx].map(normHeader);
  const col = {} as Record<Column, number>;
  for (const [key, names] of Object.entries(COLUMNS) as [Column, readonly string[]][]) {
    col[key] = header.findIndex((h) => names.includes(h));
  }
  const missing = REQUIRED.filter((k) => col[k] < 0);
  if (missing.length) return { rows: [], fileError: `Kolom wajib tidak ditemukan: ${missing.join(", ")}.` };

  const findKelompok = buildKelompokIndex(ctx.kelompok);
  const seen = new Set<string>();
  const rows: ImportRow[] = [];

  for (let i = headerIdx + 1; i < sheetRows.length; i++) {
    const r = sheetRows[i];
    const get = (k: Column) => (col[k] >= 0 ? r[col[k]] : null);
    const nameRaw = text(get("name"), 120);
    // Lewati baris kosong dan baris contoh dari template.
    if (!nameRaw && !text(get("kelompok"), 200)) continue;
    if (norm(r[0]) === "contoh" || norm(nameRaw).startsWith("contoh:")) continue;

    const base = {
      row: i + 1,
      name: nameRaw ?? "",
      kelompok: String(get("kelompok") ?? ""),
      jenjang: [get("jenjang"), get("kategori")].filter(Boolean).join(" "),
    };
    const fail = (message: string): ImportRow => ({ ...base, status: "error", message });

    if (rows.length >= MAX_IMPORT_ROWS) {
      return { rows, fileError: `Maksimal ${MAX_IMPORT_ROWS} baris per file. Pecah file menjadi beberapa bagian.` };
    }
    if (!nameRaw || nameRaw.length < 2) {
      rows.push(fail("Nama wajib diisi"));
      continue;
    }
    const gender = parseGender(get("gender"));
    if (!gender) {
      rows.push(fail("Jenis kelamin harus L atau P"));
      continue;
    }
    const birthDate = parseDate(get("birthDate"));
    if (!birthDate) {
      rows.push(fail("Tanggal lahir tidak valid (contoh 14/03/2011)"));
      continue;
    }
    if (birthDate < "1980-01-01" || birthDate > new Date().toISOString().slice(0, 10)) {
      rows.push(fail("Tanggal lahir di luar rentang wajar"));
      continue;
    }
    const kelompokId = findKelompok(get("kelompok"));
    if (kelompokId === "ambigu") {
      rows.push(fail("Nama kelompok ada di beberapa desa; tulis \"Desa / Kelompok\""));
      continue;
    }
    if (!kelompokId) {
      rows.push(fail("Kelompok tidak ditemukan atau di luar lingkup Anda"));
      continue;
    }
    const j = ctx.jenjang.find((x) => norm(x.name).replace(/[^a-z]/g, "") === norm(get("jenjang")).replace(/[^a-z]/g, ""));
    if (!j) {
      rows.push(fail("Jenjang harus Pra Remaja atau Remaja"));
      continue;
    }
    const katRaw = norm(get("kategori"));
    let kategoriId: string | null = null;
    if (j.kategori.length > 0) {
      const k = j.kategori.find((x) => norm(x.name) === katRaw);
      if (!k) {
        rows.push(fail(`Kategori wajib untuk ${j.name}: ${j.kategori.map((x) => x.name).join(" atau ")}`));
        continue;
      }
      kategoriId = k.id;
    } else if (katRaw) {
      rows.push(fail(`${j.name} tidak memakai kategori; kosongkan kolom Kategori`));
      continue;
    }
    const guardianPhone = normalizePhone(get("guardianPhone"));
    if (guardianPhone === undefined) {
      rows.push(fail("No. HP tidak valid (contoh 081234567890)"));
      continue;
    }

    const key = duplicateKey(kelompokId, nameRaw, birthDate);
    if (ctx.existingKeys.has(key)) {
      rows.push({ ...base, status: "duplikat", message: "Sudah terdaftar di kelompok ini; dilewati" });
      continue;
    }
    if (seen.has(key)) {
      rows.push({ ...base, status: "duplikat", message: "Baris ganda di file ini; dilewati" });
      continue;
    }
    seen.add(key);

    rows.push({
      ...base,
      status: "ok",
      data: {
        kelompokId,
        name: nameRaw,
        gender,
        birthDate,
        jenjangId: j.id,
        kategoriId,
        school: text(get("school"), 120),
        guardianName: text(get("guardianName"), 120),
        guardianPhone,
        notes: text(get("notes"), 500),
      },
    });
  }
  return { rows };
}

/** Baca workbook dan ambil baris mentah sheet "Generus" (atau sheet pertama yang cocok). */
export function readGenerusSheet(buffer: ArrayBuffer | Uint8Array): unknown[][] | null {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const name =
    wb.SheetNames.find((n) => norm(n) === "generus") ??
    wb.SheetNames.find((n) => {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, raw: true, defval: null });
      return rows.slice(0, 5).some((r) => r.some((c) => normHeader(c) === "nama lengkap"));
    });
  if (!name) return null;
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true });
}
