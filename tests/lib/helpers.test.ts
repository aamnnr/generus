import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { generateTempPassword, MIN_PASSWORD_LENGTH } = await import("@/lib/password");
const { dbErrorMessage } = await import("@/lib/db-error");

describe("generateTempPassword", () => {
  it("panjang sesuai, tanpa karakter yang mirip, dan acak", () => {
    const pw = generateTempPassword();
    expect(pw).toHaveLength(10);
    expect(pw.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH);
    expect(pw).not.toMatch(/[0O1lI]/);
    expect(new Set(Array.from({ length: 50 }, () => generateTempPassword())).size).toBe(50);
  });
});

describe("dbErrorMessage", () => {
  it("meneruskan pesan trigger (P0001) dari dalam cause", () => {
    const err = new Error("Failed query", { cause: { code: "P0001", message: "Peran kurikulum hanya untuk unit tingkat daerah" } });
    expect(dbErrorMessage(err)).toBe("Peran kurikulum hanya untuk unit tingkat daerah");
  });
  it("menerjemahkan duplikat dan akses ditolak", () => {
    expect(dbErrorMessage({ code: "23505" })).toBe("Data yang sama sudah ada.");
    expect(dbErrorMessage({ cause: { code: "42501" } })).toBe("Anda tidak punya akses untuk tindakan ini.");
  });
  it("menyembunyikan detail error lain", () => {
    expect(dbErrorMessage(new Error("connection refused 10.0.0.1"))).toBe("Terjadi kesalahan. Coba lagi.");
  });
});
