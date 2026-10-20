import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/rls", () => ({ withRls: vi.fn() }));

describe("helper bulan laporan", async () => {
  const { monthRange, recentMonths, isMonth, monthLabel } = await import("@/lib/laporan");

  it("rentang bulan di zona Asia/Jakarta", () => {
    const r = monthRange("2026-10");
    expect(r.from.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(r.endIso).toBe("2026-10-31");
    expect(monthRange("2026-12").to.toISOString()).toBe("2026-12-31T17:00:00.000Z");
    expect(monthRange("2026-02").endIso).toBe("2026-02-28");
  });

  it("daftar bulan & validasi", () => {
    expect(recentMonths(3, "2026-01")).toEqual(["2026-01", "2025-12", "2025-11"]);
    expect(isMonth("2026-10")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(monthLabel("2026-10")).toBe("Oktober 2026");
  });
});
