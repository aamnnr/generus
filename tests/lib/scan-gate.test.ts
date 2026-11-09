import { describe, expect, it } from "vitest";
import { createScanGate, pushLog, SAME_CODE_RELEASE_MS } from "@/lib/scan-gate";

describe("createScanGate", () => {
  it("kartu yang ditahan lama di depan kamera hanya diproses sekali", () => {
    const gate = createScanGate();
    const hits = [];
    // Terbaca tiap 250 ms selama 10 detik.
    for (let t = 0; t <= 10_000; t += 250) hits.push(gate.accept("GNR1:A", t));
    expect(hits.filter(Boolean)).toHaveLength(1);
  });

  it("kartu yang sama diterima lagi setelah disingkirkan sebentar", () => {
    const gate = createScanGate();
    expect(gate.accept("GNR1:A", 0)).toBe(true);
    expect(gate.accept("GNR1:A", 500)).toBe(false);
    expect(gate.accept("GNR1:A", 500 + SAME_CODE_RELEASE_MS)).toBe(true);
  });

  it("kartu lain langsung diterima", () => {
    const gate = createScanGate();
    expect(gate.accept("GNR1:A", 0)).toBe(true);
    expect(gate.accept("GNR1:B", 100)).toBe(true);
    expect(gate.accept("GNR1:A", 200)).toBe(false);
  });
});

describe("pushLog", () => {
  it("hasil dengan kunci sama digabung, naik ke atas, dan dihitung", () => {
    let log = pushLog([], "a", "Ani hadir", 1);
    log = pushLog(log, "b", "Budi hadir", 2);
    log = pushLog(log, "a", "Ani sudah tercatat", 3);
    expect(log.map((e) => [e.key, e.value, e.count])).toEqual([
      ["a", "Ani sudah tercatat", 2],
      ["b", "Budi hadir", 1],
    ]);
  });

  it("dibatasi jumlah baris", () => {
    let log = pushLog<number>([], "0", 0, 0);
    for (let i = 1; i < 20; i++) log = pushLog(log, String(i), i, i, 5);
    expect(log.map((e) => e.value)).toEqual([19, 18, 17, 16, 15]);
  });
});
