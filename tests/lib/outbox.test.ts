import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { discardRejected, enqueue, flush, offlineDb, retryRejected, type Sender } from "@/lib/offline/outbox";

const A = "agenda-a";
const B = "agenda-b";

beforeEach(async () => {
  await offlineDb().outbox.clear();
});

const all = () => offlineDb().outbox.toArray();

describe("outbox presensi", () => {
  it("ketukan terakhir menimpa yang lama untuk generus yang sama", async () => {
    await enqueue([{ agendaId: A, generusId: "g1", status: "hadir" }]);
    await enqueue([{ agendaId: A, generusId: "g1", status: "izin" }]);
    expect((await all()).map((i) => i.status)).toEqual(["izin"]);
  });

  it("mengirim per agenda lalu mengosongkan antrian", async () => {
    await enqueue([
      { agendaId: A, generusId: "g1", status: "hadir" },
      { agendaId: A, generusId: "g2", status: "sakit" },
      { agendaId: B, generusId: "g1", status: "alpa" },
    ]);
    const calls: { agendaId: string; n: number }[] = [];
    const send: Sender = async (input) => {
      calls.push({ agendaId: input.agendaId, n: input.entries.length });
      return { saved: input.entries.length };
    };
    expect(await flush(send)).toEqual({ sent: 3, rejected: 0, offline: false });
    expect(calls.sort((x, y) => x.agendaId.localeCompare(y.agendaId))).toEqual([
      { agendaId: A, n: 2 },
      { agendaId: B, n: 1 },
    ]);
    expect(await all()).toEqual([]);
  });

  it("jaringan putus: item tetap di antrian dan bisa dikirim ulang", async () => {
    await enqueue([{ agendaId: A, generusId: "g1", status: "hadir" }]);
    const res = await flush(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(res.offline).toBe(true);
    expect((await all())[0]).toMatchObject({ status: "hadir", attempts: 1 });
    expect((await flush(async (i) => ({ saved: i.entries.length }))).sent).toBe(1);
    expect(await all()).toEqual([]);
  });

  it("respons kosong/tidak dikenal tidak menghapus antrian", async () => {
    await enqueue([{ agendaId: A, generusId: "g1", status: "hadir" }]);
    const res = await flush(async () => undefined as never);
    expect(res.offline).toBe(true);
    expect(await all()).toHaveLength(1);
  });

  it("ditolak server: ditandai error, tidak dicoba ulang otomatis, bisa diulang atau dibuang", async () => {
    await enqueue([{ agendaId: A, generusId: "g1", status: "hadir" }]);
    await flush(async () => ({ error: "Batas waktu lewat" }));
    expect((await all())[0].error).toBe("Batas waktu lewat");

    let called = false;
    await flush(async () => ((called = true), { saved: 1 }));
    expect(called).toBe(false);

    await retryRejected();
    expect((await all())[0].error).toBeUndefined();
    await flush(async () => ({ error: "Masih ditolak" }));
    await discardRejected(A);
    expect(await all()).toEqual([]);
  });

  it("ketukan baru selama pengiriman tidak ikut terhapus", async () => {
    await enqueue([{ agendaId: A, generusId: "g1", status: "hadir" }]);
    await flush(async () => {
      await new Promise((r) => setTimeout(r, 5));
      await enqueue([{ agendaId: A, generusId: "g1", status: "terlambat" }]);
      return { saved: 1 };
    });
    expect((await all()).map((i) => i.status)).toEqual(["terlambat"]);
  });

  it("flush bersamaan tidak mengirim dua kali", async () => {
    await enqueue([{ agendaId: A, generusId: "g1", status: "hadir" }]);
    let calls = 0;
    const send: Sender = async (i) => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return { saved: i.entries.length };
    };
    await Promise.all([flush(send), flush(send)]);
    expect(calls).toBe(1);
  });
});
