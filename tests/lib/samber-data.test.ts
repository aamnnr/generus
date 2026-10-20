import { describe, expect, it } from "vitest";
import { generateSamberData, kelompokName, normalizeName } from "../../scripts/seed/samber-data";

describe("data Samber", () => {
  it("13 kelompok, 302 generus, di Desa Samber Klaten Timur 1", () => {
    const d = generateSamberData();
    expect(d.daerah).toBe("Klaten Timur 1");
    expect(d.desa.map((x) => x.name)).toEqual(["Samber"]);
    const kel = d.desa[0].kelompok;
    expect(kel).toHaveLength(13);
    expect(kel.reduce((s, k) => s + k.generus.length, 0)).toBe(302);
    expect(kel.map((k) => k.name)).toContain("Jurang Kajong Selatan");
    expect(kel.map((k) => k.name)).toContain("Karang Jati 1");
  });

  it("jenjang & kategori konsisten, tanggal valid, deterministik", () => {
    const all = generateSamberData().desa[0].kelompok.flatMap((k) => k.generus);
    for (const g of all) {
      if (g.jenjang === "Pra Remaja") expect(g.kategori).toBeNull();
      else expect(["Pelajar", "Mandiri"]).toContain(g.kategori);
      expect(Number.isNaN(Date.parse(g.birthDate))).toBe(false);
      expect(["L", "P"]).toContain(g.gender);
    }
    expect(generateSamberData()).toEqual(generateSamberData());
  });

  it("merapikan nama dari nama file", () => {
    expect(normalizeName("Muh.aufar Firdaus")).toBe("Muh. Aufar Firdaus");
    expect(normalizeName("T.rachmat.r")).toBe("T. Rachmat R.");
    expect(normalizeName("M.arifin")).toBe("M. Arifin");
    expect(normalizeName("Risawati P.n")).toBe("Risawati P.N.");
    expect(normalizeName("Zevaniya Nazwa.a")).toBe("Zevaniya Nazwa A.");
    expect(normalizeName("Darul Ma_arif")).toBe("Darul Ma'arif");
    expect(normalizeName("M. Azza Reza Al-m")).toBe("M. Azza Reza Al-M");
    expect(normalizeName("Ahmad Nouval A.")).toBe("Ahmad Nouval A.");
    expect(normalizeName("Panji Ahmad F.R.")).toBe("Panji Ahmad F.R.");
    expect(kelompokName("KARANG JATI 2")).toBe("Karang Jati 2");
  });
});
