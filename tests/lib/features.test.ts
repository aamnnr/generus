import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/rls", () => ({ withRls: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServer: vi.fn() }));

const { kurikulumEnabled } = await import("@/lib/features");
const { buildNav } = await import("@/components/shell/nav");

type User = Parameters<typeof buildNav>[0];
const user = (roles: { role: "superadmin" | "kurikulum" | "admin" | "kyai"; level: "daerah" | "desa" | "kelompok" }[]): User =>
  ({
    id: "u",
    name: "Uji",
    email: null,
    mustChangePassword: false,
    isSuperadmin: roles.some((r) => r.role === "superadmin"),
    claims: { sub: "u" },
    roles: roles.map((r) => ({ ...r, unitId: "x", unitName: "X" })),
  }) as User;

const hrefs = (u: User) => buildNav(u).main.map((i) => i.href);

afterEach(() => {
  delete process.env.FEATURE_KURIKULUM;
});

describe("saklar modul kurikulum", () => {
  it("aktif secara bawaan; mati dengan off/0/false", () => {
    expect(kurikulumEnabled()).toBe(true);
    for (const v of ["off", "OFF", "0", "false", " no "]) {
      process.env.FEATURE_KURIKULUM = v;
      expect(kurikulumEnabled()).toBe(false);
    }
    process.env.FEATURE_KURIKULUM = "on";
    expect(kurikulumEnabled()).toBe(true);
  });

  it("server uji: menu kurikulum & capaian tampil", () => {
    expect(hrefs(user([{ role: "admin", level: "desa" }]))).toEqual(
      expect.arrayContaining(["/agenda", "/generus", "/capaian", "/kurikulum", "/laporan"]),
    );
    expect(hrefs(user([{ role: "kurikulum", level: "daerah" }]))).toEqual(["/beranda", "/capaian/rekap", "/kurikulum"]);
  });

  it("server resmi (Tahap 1): hanya database, presensi, laporan", () => {
    process.env.FEATURE_KURIKULUM = "off";
    const admin = hrefs(user([{ role: "admin", level: "desa" }]));
    expect(admin).toEqual(expect.arrayContaining(["/beranda", "/agenda", "/generus", "/laporan"]));
    expect(admin.some((h) => h.startsWith("/kurikulum") || h.startsWith("/capaian"))).toBe(false);
    expect(hrefs(user([{ role: "kyai", level: "kelompok" }])).some((h) => h.startsWith("/capaian"))).toBe(false);
  });
});
