import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  duplicateKey,
  normalizePhone,
  parseDate,
  readGenerusSheet,
  validateRows,
  type ImportContext,
} from "@/lib/import/generus-import";
import { buildImportWorkbook } from "../../scripts/seed/export-xlsx";
import { createTestDb, createUnit } from "../db/harness";

const ctx: ImportContext = {
  kelompok: [
    { id: "k-s1", name: "Sukamaju 1", desaName: "Sukamaju" },
    { id: "k-s2", name: "Sukamaju 2", desaName: "Sukamaju" },
    { id: "k-m1", name: "Inti", desaName: "Mekarsari" },
    { id: "k-w1", name: "Inti", desaName: "Wonosari" },
  ],
  jenjang: [
    { id: "j-pr", name: "Pra Remaja", kategori: [] },
    { id: "j-r", name: "Remaja", kategori: [{ id: "k-pel", name: "Pelajar" }, { id: "k-man", name: "Mandiri" }] },
  ],
  existingKeys: new Set([duplicateKey("k-s1", "Sudah Ada", "2010-01-01")]),
};

const HEADER = ["No", "Nama Lengkap *", "Jenis Kelamin *", "Tanggal Lahir *", "Kelompok *", "Jenjang *", "Kategori", "Sekolah / Kelas", "Nama Orang Tua/Wali", "No. HP Orang Tua/Wali", "Catatan"];
const run = (...rows: unknown[][]) => validateRows([HEADER, ...rows], ctx);

describe("parseDate", () => {
  it("menerima serial Excel tanpa pergeseran zona waktu", () => {
    expect(parseDate(40616)).toBe("2011-03-14");
  });
  it("menerima teks dd/mm/yyyy dan yyyy-mm-dd, menolak tanggal mustahil", () => {
    expect(parseDate("14/03/2011")).toBe("2011-03-14");
    expect(parseDate("4-3-2011")).toBe("2011-03-04");
    expect(parseDate("2011-03-14")).toBe("2011-03-14");
    expect(parseDate("31/02/2012")).toBeUndefined();
    expect(parseDate("besok")).toBeUndefined();
  });
});

describe("normalizePhone", () => {
  it("merapikan format umum & mengembalikan 0 yang dibuang Excel", () => {
    expect(normalizePhone("0812-3456 7890")).toBe("081234567890");
    expect(normalizePhone(81234567890)).toBe("081234567890");
    expect(normalizePhone("6281234567890")).toBe("+6281234567890");
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("12345")).toBeUndefined();
  });
});

describe("validateRows", () => {
  it("melewati baris contoh dan baris kosong", () => {
    const r = run(["Contoh", "Contoh: Ahmad", "L", 40616, "Sukamaju / Sukamaju 1", "Pra Remaja"], [], [null, null]);
    expect(r.rows).toEqual([]);
  });

  it("menerima baris valid dan mengisi id kelompok/jenjang/kategori", () => {
    const r = run([1, " Siti  Aminah ", "p", "14/03/2008", "sukamaju / sukamaju 1", "remaja", "pelajar", "SMA 1", "Bpk. X", "0812 3456 7890"]);
    expect(r.rows[0]).toMatchObject({
      row: 2,
      status: "ok",
      data: { name: "Siti Aminah", gender: "P", birthDate: "2008-03-14", kelompokId: "k-s1", jenjangId: "j-r", kategoriId: "k-pel", guardianPhone: "081234567890" },
    });
  });

  it("kelompok boleh ditulis tanpa desa bila namanya unik", () => {
    expect(run([1, "A B", "L", 40616, "Sukamaju 2", "Pra Remaja"]).rows[0].data?.kelompokId).toBe("k-s2");
    expect(run([1, "A B", "L", 40616, "Inti", "Pra Remaja"]).rows[0].message).toMatch(/beberapa desa/);
  });

  it("menolak aturan jenjang/kategori, kelompok di luar lingkup, dan data wajib kosong", () => {
    const msgs = run(
      [1, "R1", "L", 40616, "Sukamaju / Sukamaju 1", "Remaja", null],
      [2, "R2", "L", 40616, "Sukamaju / Sukamaju 1", "Pra Remaja", "Pelajar"],
      [3, "R3", "L", 40616, "Desa Lain / Kelompok X", "Pra Remaja"],
      [4, "R4", "X", 40616, "Sukamaju / Sukamaju 1", "Pra Remaja"],
      [5, "R5", "L", "bukan tanggal", "Sukamaju / Sukamaju 1", "Pra Remaja"],
      [6, "R6", "L", 40616, "Sukamaju / Sukamaju 1", "Dewasa"],
      [7, "R7", "L", 40616, "Sukamaju / Sukamaju 1", "Pra Remaja", null, null, null, "123"],
    ).rows.map((r) => r.message);
    expect(msgs).toEqual([
      expect.stringMatching(/Kategori wajib/),
      expect.stringMatching(/tidak memakai kategori/),
      expect.stringMatching(/tidak ditemukan/),
      expect.stringMatching(/Jenis kelamin/),
      expect.stringMatching(/Tanggal lahir/),
      expect.stringMatching(/Jenjang/),
      expect.stringMatching(/No. HP/),
    ]);
  });

  it("menandai duplikat terhadap database dan di dalam file", () => {
    const r = run(
      [1, "Sudah Ada", "L", "01/01/2010", "Sukamaju / Sukamaju 1", "Pra Remaja"],
      [2, "Baru", "L", "01/01/2010", "Sukamaju / Sukamaju 1", "Pra Remaja"],
      [3, "baru", "L", "01/01/2010", "Sukamaju / Sukamaju 1", "Pra Remaja"],
    );
    expect(r.rows.map((x) => x.status)).toEqual(["duplikat", "ok", "duplikat"]);
  });

  it("memberi pesan jelas bila bukan template", () => {
    expect(validateRows([["a", "b"]], ctx).fileError).toMatch(/Nama Lengkap/);
  });
});

describe("file template nyata → database", () => {
  it("membaca template terisi, memvalidasi, dan semua baris valid lolos trigger database", async () => {
    const wb = buildImportWorkbook(30, { withErrors: true });
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const sheet = readGenerusSheet(new Uint8Array(buffer));
    expect(sheet).not.toBeNull();

    const db = await createTestDb();
    const daerah = await createUnit(db, "daerah", "Daerah Uji", null);
    const kelompok: ImportContext["kelompok"] = [];
    for (const desa of ["Sukamaju", "Sukamulya"]) {
      const d = await createUnit(db, "desa", desa, daerah);
      for (let i = 1; i <= 3; i++) kelompok.push({ id: await createUnit(db, "kelompok", `${desa} ${i}`, d), name: `${desa} ${i}`, desaName: desa });
    }
    const jRows = (await db.query<{ id: string; name: string; kid: string | null; kname: string | null }>(
      `SELECT j.id, j.name, k.id kid, k.name kname FROM jenjang j LEFT JOIN jenjang_kategori k ON k.jenjang_id = j.id`,
    )).rows;
    const jenjang = [...new Set(jRows.map((r) => r.id))].map((id) => ({
      id,
      name: jRows.find((r) => r.id === id)!.name,
      kategori: jRows.filter((r) => r.id === id && r.kid).map((r) => ({ id: r.kid!, name: r.kname! })),
    }));

    const result = validateRows(sheet!, { kelompok, jenjang, existingKeys: new Set() });
    const counts = { ok: 0, error: 0, duplikat: 0 };
    for (const r of result.rows) counts[r.status]++;
    expect(counts).toEqual({ ok: 30, error: 3, duplikat: 1 });

    for (const r of result.rows.filter((x) => x.status === "ok")) {
      const d = r.data!;
      await db.query(
        `INSERT INTO generus (kelompok_id, name, gender, birth_date, jenjang_id, kategori_id, school, guardian_name, guardian_phone, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [d.kelompokId, d.name, d.gender, d.birthDate, d.jenjangId, d.kategoriId, d.school, d.guardianName, d.guardianPhone, d.notes],
      );
    }
    const [{ n }] = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM generus`)).rows;
    expect(n).toBe(30);
  }, 60_000);
});
