import * as XLSX from "xlsx";
import { getCurrentUser, LEVEL_LABEL } from "@/lib/auth";
import { getRekapUnits, getUnitWithChildren, listPublishedPeriods } from "@/lib/capaian";
import { currentMonth, getKehadiranUnits, getLaporanGenerus, getPeringatanAlpa, hadirRate, isMonth, laporanRootUnit, monthRange } from "@/lib/laporan";

// Unduhan laporan bulanan (.xlsx): ringkasan per unit, rincian per generus, peringatan.

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
const label = (u: { level: keyof typeof LEVEL_LABEL; name: string }) =>
  u.name.toLowerCase().startsWith(LEVEL_LABEL[u.level].toLowerCase()) ? u.name : `${LEVEL_LABEL[u.level]} ${u.name}`;

export async function GET(request: Request) {
  const me = await getCurrentUser();
  const root = laporanRootUnit(me);
  if (!root) return new Response("Anda tidak punya akses ke laporan.", { status: 403 });

  const url = new URL(request.url);
  const month = isMonth(url.searchParams.get("bulan")) ? url.searchParams.get("bulan")! : currentMonth();
  const range = monthRange(month);
  const [tree, periods] = await Promise.all([
    getUnitWithChildren(me.claims, url.searchParams.get("unit") ?? root.unitId),
    listPublishedPeriods(me.claims),
  ]);
  if (!tree) return new Response("Unit tidak ditemukan.", { status: 404 });
  const period = periods.find((p) => p.startsOn <= range.endIso && p.endsOn >= range.startIso) ?? null;
  const units = [tree.unit, ...tree.children];
  const ids = units.map((u) => u.id);

  let kehadiran, generus, alpa, capaian;
  try {
    [kehadiran, generus, alpa, capaian] = await Promise.all([
      getKehadiranUnits(me.claims, range.from, range.to, ids),
      getLaporanGenerus(me.claims, range.from, range.to, tree.unit.id, period?.id ?? null),
      getPeringatanAlpa(me.claims, tree.unit.id),
      period ? getRekapUnits(me.claims, period.id, null, ids) : Promise.resolve([]),
    ]);
  } catch {
    return new Response("Anda tidak punya akses ke laporan unit ini.", { status: 403 });
  }

  const ringkasan: (string | number | null)[][] = [
    ["Laporan Bulanan Generus"],
    ["Bulan", range.label],
    ["Unit", label(tree.unit)],
    ["Periode target", period ? `${period.name} (${period.startsOn} s.d. ${period.endsOn})` : "-"],
    ["Dibuat", new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })],
    [],
    [
      "Unit", "Generus aktif", "Agenda terkunci", "Presensi", "Hadir", "Terlambat", "Izin", "Sakit", "Alpa", "% Kehadiran",
      "Capaian tuntas", "Capaian dinilai", "% Capaian", "Materi disampaikan", "Materi × kelompok",
    ],
  ];
  for (const u of units) {
    const k = kehadiran.find((x) => x.unitId === u.id);
    if (!k) continue;
    const c = capaian.find((x) => x.unitId === u.id);
    ringkasan.push([
      label(u), k.generus, k.agendas, k.total, k.hadir, k.terlambat, k.izin, k.sakit, k.alpa, hadirRate(k),
      c?.tuntas ?? null, c?.slots ?? null, c ? pct(c.tuntas, c.slots) : null, c?.delivered ?? null, c?.deliverable ?? null,
    ]);
  }

  const rincian = generus.map((g) => ({
    Desa: g.desa,
    Kelompok: g.kelompok,
    Nama: g.name,
    "L/P": g.gender,
    Jenjang: g.kategori ? `${g.jenjang} ${g.kategori}` : g.jenjang,
    Status: g.status,
    Presensi: g.total,
    Hadir: g.hadir,
    Terlambat: g.terlambat,
    Izin: g.izin,
    Sakit: g.sakit,
    Alpa: g.alpa,
    "% Kehadiran": pct(g.hadir + g.terlambat, g.total),
    "Capaian tuntas": g.capSlots ? g.capTuntas : null,
    "Capaian dinilai": g.capSlots || null,
    "Alpa 3× berturut": g.alpaStreak ? "Ya" : "",
  }));

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(ringkasan);
  ws1["!cols"] = [{ wch: 28 }, ...Array(14).fill({ wch: 12 })];
  XLSX.utils.book_append_sheet(wb, ws1, "Ringkasan");
  const ws2 = XLSX.utils.json_to_sheet(rincian);
  ws2["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 5 }, { wch: 18 }, { wch: 14 }, ...Array(10).fill({ wch: 10 })];
  XLSX.utils.book_append_sheet(wb, ws2, "Generus");
  const ws3 = XLSX.utils.json_to_sheet(
    alpa.length
      ? alpa.map((a) => ({ Nama: a.name, Kelompok: a.kelompok, "Agenda terakhir": a.lastAt.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }) }))
      : [{ Nama: "Tidak ada generus dengan alpa 3× berturut-turut" }],
  );
  ws3["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Peringatan alpa");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
  const safe = label(tree.unit).replace(/[^\w-]+/g, "-");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Laporan-${safe}-${month}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
