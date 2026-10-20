import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { enqueue, offlineDb, saveRoster } from "@/lib/offline/outbox";
import { processScan, recordBySearch } from "@/lib/offline/scan";
import { qrPayload, sha256Hex } from "@/lib/qr";

const AG = "agenda-1";
const TOKEN_A = "AAAAAAAAAAAAAAAA";
const TOKEN_B = "BBBBBBBBBBBBBBBB";
const late = new Date("2026-10-25T12:45:00Z");

async function setup(overrides: { lockedAt?: string | null; cancelledAt?: string | null } = {}) {
  await offlineDb().outbox.clear();
  await offlineDb().roster.clear();
  await saveRoster(
    {
      id: AG,
      title: "Pengajian",
      unitName: "Sukamaju",
      level: "desa",
      startsAt: "2026-10-25T12:30:00Z",
      endsAt: "2026-10-25T14:00:00Z",
      lateAfter: late.toISOString(),
      lockedAt: overrides.lockedAt ?? null,
      cancelledAt: overrides.cancelledAt ?? null,
    },
    [
      { generusId: "g-a", name: "Ahmad", gender: "L", kelompok: "S1", desa: "Sukamaju", tokenHash: await sha256Hex(qrPayload(TOKEN_A)), status: null },
      { generusId: "g-b", name: "Budi", gender: "L", kelompok: "S2", desa: "Sukamaju", tokenHash: await sha256Hex(qrPayload(TOKEN_B)), status: "izin" },
      { generusId: "g-c", name: "Citra", gender: "P", kelompok: "S2", desa: "Sukamaju", tokenHash: null, status: null },
    ],
  );
}

beforeEach(() => setup());

describe("pemindai offline", () => {
  it("kartu valid sebelum batas → hadir, masuk antrian mode scan", async () => {
    const r = await processScan(AG, `gnr1:${TOKEN_A.toLowerCase()}`, new Date("2026-10-25T12:40:00Z"));
    expect(r).toEqual({ kind: "ok", name: "Ahmad", kelompok: "S1", status: "hadir" });
    expect(await offlineDb().outbox.toArray()).toMatchObject([{ generusId: "g-a", status: "hadir", mode: "scan" }]);
  });

  it("setelah batas terlambat → terlambat", async () => {
    const r = await processScan(AG, qrPayload(TOKEN_A), new Date("2026-10-25T12:50:00Z"));
    expect(r).toMatchObject({ kind: "ok", status: "terlambat" });
  });

  it("scan ulang & yang sudah tercatat di server ditandai duplikat", async () => {
    await processScan(AG, qrPayload(TOKEN_A), new Date("2026-10-25T12:40:00Z"));
    expect(await processScan(AG, qrPayload(TOKEN_A))).toMatchObject({ kind: "duplicate", name: "Ahmad", status: "hadir" });
    expect(await processScan(AG, qrPayload(TOKEN_B))).toMatchObject({ kind: "duplicate", name: "Budi", status: "izin" });
    expect(await offlineDb().outbox.count()).toBe(1);
  });

  it("tetap duplikat setelah antrian terkirim dan dikosongkan", async () => {
    await processScan(AG, qrPayload(TOKEN_A), new Date("2026-10-25T12:40:00Z"));
    await offlineDb().outbox.clear();
    expect(await processScan(AG, qrPayload(TOKEN_A))).toMatchObject({ kind: "duplicate", status: "hadir" });
  });

  it("QR lain dan kartu yang tidak terdaftar ditolak", async () => {
    expect(await processScan(AG, "https://contoh.com")).toEqual({ kind: "invalid" });
    expect(await processScan(AG, qrPayload("CCCCCCCCCCCCCCCC"))).toEqual({ kind: "unknown" });
  });

  it("cadangan cari nama untuk peserta tanpa kartu", async () => {
    const r = await recordBySearch(AG, "g-c", new Date("2026-10-25T12:40:00Z"));
    expect(r).toMatchObject({ kind: "ok", name: "Citra", status: "hadir" });
    expect((await offlineDb().outbox.toArray())[0].mode).toBe("search");
  });

  it("status antrian (mis. dari checklist) dianggap sudah tercatat", async () => {
    await enqueue([{ agendaId: AG, generusId: "g-a", status: "sakit" }]);
    expect(await processScan(AG, qrPayload(TOKEN_A))).toMatchObject({ kind: "duplicate", status: "sakit" });
  });

  it("agenda terkunci / dibatalkan / belum diunduh tidak bisa dipindai", async () => {
    await setup({ lockedAt: "2026-10-26T00:00:00Z" });
    expect(await processScan(AG, qrPayload(TOKEN_A))).toMatchObject({ kind: "closed" });
    await setup({ cancelledAt: "2026-10-24T00:00:00Z" });
    expect(await processScan(AG, qrPayload(TOKEN_A))).toMatchObject({ kind: "closed" });
    expect(await processScan("agenda-lain", qrPayload(TOKEN_A))).toMatchObject({ kind: "closed", reason: expect.stringMatching(/diunduh/) });
  });
});
