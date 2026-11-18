"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/app-link";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { CheckIcon, LockIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useOffline } from "next/offline";
import { downloadRoster } from "@/app/(app)/agenda/actions";
import { requestSync } from "@/components/outbox-sync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { offlineDb, saveRoster, type RosterItem } from "@/lib/offline/outbox";
import { processScan, recordBySearch, type ScanResult } from "@/lib/offline/scan";
import { beep, createQrDetector, type QrDetector } from "@/lib/qr-reader";
import { createScanGate, pushLog, type LogEntry } from "@/lib/scan-gate";

const STATUS_LABEL: Record<string, string> = { hadir: "Hadir", terlambat: "Terlambat", izin: "Izin", sakit: "Sakit", alpa: "Alpa" };

/** Kunci riwayat: orang yang sama, atau jenis pesan galat yang sama, digabung jadi satu baris. */
function resultKey(r: ScanResult): string {
  return r.kind === "ok" || r.kind === "duplicate" ? `p:${r.name}|${r.kelompok}` : r.kind === "closed" ? `c:${r.reason}` : r.kind;
}

export function Scanner() {
  const agendaId = useSearchParams().get("agenda") ?? "";
  const offline = useOffline();
  const [download, setDownload] = useState<{ state: "idle" | "loading" | "error"; message?: string }>({ state: "idle" });
  const [recent, setRecent] = useState<LogEntry<ScanResult>[]>([]);
  const [query, setQuery] = useState("");

  const agenda = useLiveQuery(() => (agendaId ? offlineDb().scanAgendas.get(agendaId) : undefined), [agendaId]);
  const roster = useLiveQuery(() => offlineDb().roster.where("agendaId").equals(agendaId).toArray(), [agendaId]);
  const queued = useLiveQuery(() => offlineDb().outbox.where("agendaId").equals(agendaId).toArray(), [agendaId]);
  const waiting = (queued ?? []).filter((q) => !q.error).length;
  const rejected = (queued ?? []).filter((q) => q.error).length;
  const recorded = useMemo(() => (roster ?? []).filter((r) => r.status).length, [roster]);

  const refresh = useCallback(async () => {
    if (!agendaId) return;
    setDownload({ state: "loading" });
    try {
      const res = await downloadRoster(agendaId);
      if (res.error || !res.agenda || !res.rows) {
        setDownload({ state: "error", message: res.error ?? "Gagal mengunduh daftar peserta." });
        return;
      }
      await saveRoster(res.agenda, res.rows.map((r) => ({ ...r, status: r.status as RosterItem["status"] })));
      setDownload({ state: "idle" });
    } catch {
      setDownload({ state: "error", message: "Tidak bisa terhubung. Memakai daftar yang tersimpan di perangkat." });
    }
  }, [agendaId]);

  // Simpan kerangka halaman & WASM pembaca QR di cache service worker agar
  // pemindai bisa dibuka lagi tanpa sinyal (navigasi di dalam aplikasi tidak
  // melewati service worker, jadi perlu diambil sekali secara eksplisit).
  useEffect(() => {
    if (!navigator.onLine || !navigator.serviceWorker?.controller) return;
    void fetch("/pindai", { headers: { "x-generus-warm": "1" } }).catch(() => {});
    void fetch("/vendor/zxing_reader.wasm").catch(() => {});
  }, []);

  // Unduh/perbarui daftar saat dibuka (bila online). Gagal = pakai data tersimpan.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkron dengan server (sistem eksternal) saat dibuka
    if (agendaId && navigator.onLine) void refresh();
  }, [agendaId, refresh]);

  const show = useCallback((result: ScanResult) => {
    // Scan ulang orang yang baru dicatat tetap menampilkan status awalnya (mis. "Hadir").
    setRecent((log) => pushLog(log, resultKey(result), result, Date.now(), { keep: (prev) => prev.kind === "ok" }));
    beep(result.kind === "ok" ? "ok" : result.kind === "duplicate" ? "warn" : "error");
    if (result.kind === "ok") requestSync();
  }, []);

  // Satu kartu diproses sekali selama masih di depan kamera (lihat lib/scan-gate).
  const gate = useRef(createScanGate());
  const handleCamera = useCallback(
    async (raw: string) => {
      if (!gate.current.accept(raw)) return;
      show(await processScan(agendaId, raw));
    },
    [agendaId, show],
  );
  // Scanner USB / ketikan manual: setiap Enter adalah niat pengguna, selalu diproses.
  const handleTyped = useCallback(async (raw: string) => show(await processScan(agendaId, raw)), [agendaId, show]);

  if (!agendaId) {
    return <p className="text-muted-foreground">Agenda tidak dipilih. Buka pemindai dari halaman agenda.</p>;
  }

  const matches =
    query.trim().length >= 2 && roster
      ? roster.filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
      : [];

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href={`/agenda/${agendaId}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Kembali ke agenda
        </Link>
        <h1 className="text-xl font-semibold">{agenda?.title ?? "Pemindai QR"}</h1>
        {agenda && (
          <p className="text-sm text-muted-foreground">
            {agenda.unitName} · terlambat setelah{" "}
            {new Date(agenda.lateAfter).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>

      <FeedbackPanel feedback={recent[0] ?? null} />

      {!agenda && download.state !== "loading" && (
        <p className="rounded-2xl bg-accent p-3 text-sm text-accent-foreground">
          {download.message ?? "Daftar peserta belum ada di perangkat ini. Buka halaman ini saat online untuk mengunduhnya."}
        </p>
      )}

      {agenda && (
        <>
          <Camera onCode={(c) => void handleCamera(c)} />
          <ManualInput onCode={(c) => void handleTyped(c)} />

          <div className="flex flex-col gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tanpa kartu? Cari nama (min. 2 huruf)" aria-label="Cari nama peserta" className="rounded-full" />
            {matches.length > 0 && (
              <ul className="flex flex-col divide-y divide-muted overflow-hidden rounded-2xl bg-card shadow-card">
                {matches.map((m) => (
                  <li key={m.generusId} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="flex-1">
                      {m.name} <span className="text-muted-foreground">· {m.kelompok}</span>
                    </span>
                    {m.status ? (
                      <span className="text-xs text-muted-foreground">{STATUS_LABEL[m.status]}</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          show(await recordBySearch(agendaId, m.generusId));
                          setQuery("");
                        }}
                      >
                        Catat hadir
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-card px-3.5 py-2.5 shadow-card">
          <div className="text-xs text-muted-foreground">Tercatat</div>
          <div className="font-heading text-[26px] leading-8 font-semibold tabular-nums">
            {recorded}
            <span className="text-sm font-normal text-muted-foreground"> / {roster?.length ?? 0}</span>
          </div>
        </div>
        <div className="rounded-2xl bg-card px-3.5 py-2.5 shadow-card">
          <div className="text-xs text-muted-foreground">Kirim ke server</div>
          <div role="status" className="text-sm">
            {rejected > 0
              ? `${rejected} ditolak`
              : waiting === 0
                ? "Semua terkirim"
                : offline
                  ? `${waiting} menunggu (offline)`
                  : `Mengirim ${waiting}…`}
          </div>
        </div>
      </div>

      {recent.length > 0 && <ScanLog entries={recent} />}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          {agenda ? `Daftar diunduh ${new Date(agenda.downloadedAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}` : ""}
          {download.state === "loading" && " · memperbarui…"}
          {download.state === "error" && agenda && ` · ${download.message}`}
        </span>
        <Button size="xs" variant="ghost" onClick={() => void refresh()} disabled={download.state === "loading" || offline}>
          Perbarui daftar
        </Button>
      </div>
    </>
  );
}

/** "pukul 07.12", atau "24/10 pukul 07.12" bila bukan hari ini. */
function recordedLabel(at: Date | null): string {
  if (!at) return "";
  const time = at.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const sameDay = at.toDateString() === new Date().toDateString();
  return sameDay ? ` pukul ${time}` : ` ${at.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} pukul ${time}`;
}

function duplicateText(r: Extract<ScanResult, { kind: "duplicate" }>): string {
  return `sudah tercatat${recordedLabel(r.recordedAt)} (${STATUS_LABEL[r.status]})`;
}

function resultTitle(r: ScanResult): string {
  switch (r.kind) {
    case "ok":
      return `${r.name} — ${STATUS_LABEL[r.status]}`;
    case "duplicate":
      return `${r.name} — ${duplicateText(r)}`;
    case "unknown":
      return "Kartu tidak dikenal / bukan peserta agenda ini";
    case "invalid":
      return "Bukan kartu Generus";
    case "closed":
      return r.reason;
  }
}

type Tone = "ok" | "repeat" | "error";

function toneOf(e: LogEntry<ScanResult>): Tone {
  const v = e.value;
  if (v.kind === "ok") return "ok";
  if (v.kind === "duplicate") return "repeat";
  return "error";
}

const TONE: Record<Tone, { icon: string; badge: string }> = {
  ok: { icon: "bg-status-hadir-soft text-status-hadir", badge: "" },
  repeat: { icon: "bg-status-terlambat-soft text-status-terlambat", badge: "bg-status-terlambat-soft text-status-terlambat" },
  error: { icon: "bg-status-alpa-soft text-status-alpa", badge: "bg-status-alpa-soft text-status-alpa" },
};

const hhmm = (ms: number | Date) => new Date(ms).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const hhmmss = (ms: number) => new Date(ms).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const LOG_PREVIEW = 8;

/**
 * Riwayat scan sesi ini: satu baris per orang (atau per jenis galat), terbaru di atas.
 * Ikon & warna = hasilnya (hijau tercatat, kuning sudah tercatat/scan ulang, merah ditolak).
 */
function ScanLog({ entries }: { entries: LogEntry<ScanResult>[] }) {
  const [all, setAll] = useState(false);
  const fresh = entries.filter((e) => e.value.kind === "ok").length;
  const repeats = entries.reduce((n, e) => n + (e.value.kind === "ok" ? e.count - 1 : e.value.kind === "duplicate" ? e.count : 0), 0);
  const rejected = entries.reduce((n, e) => n + (e.value.kind === "ok" || e.value.kind === "duplicate" ? 0 : e.count), 0);
  const shown = all ? entries : entries.slice(0, LOG_PREVIEW);

  return (
    <section className="flex flex-col gap-2" aria-label="Riwayat scan">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-1">
        <h2 className="text-sm font-semibold">Riwayat scan</h2>
        <div className="flex flex-wrap gap-1.5 text-xs font-medium">
          <span className="rounded-full bg-status-hadir-soft px-2 py-0.5 text-status-hadir tabular-nums">{fresh} tercatat</span>
          {repeats > 0 && <span className="rounded-full bg-status-terlambat-soft px-2 py-0.5 text-status-terlambat tabular-nums">{repeats} ulang</span>}
          {rejected > 0 && <span className="rounded-full bg-status-alpa-soft px-2 py-0.5 text-status-alpa tabular-nums">{rejected} ditolak</span>}
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-muted overflow-hidden rounded-2xl bg-card shadow-card">
        {shown.map((e, i) => (
          <ScanLogRow key={e.key} e={e} latest={i === 0} />
        ))}
      </ul>
      {entries.length > LOG_PREVIEW && (
        <Button type="button" variant="ghost" size="sm" className="self-center" onClick={() => setAll((v) => !v)}>
          {all ? "Tampilkan lebih sedikit" : `Tampilkan semua (${entries.length})`}
        </Button>
      )}
    </section>
  );
}

function ScanLogRow({ e, latest }: { e: LogEntry<ScanResult>; latest: boolean }) {
  const v = e.value;
  const tone = toneOf(e);
  const Icon = v.kind === "closed" ? LockIcon : tone === "ok" ? CheckIcon : tone === "repeat" ? RotateCcwIcon : XIcon;
  let title: string;
  let detail: string;
  switch (v.kind) {
    case "ok":
      title = v.name;
      // Jam tercatat hanya perlu disebut bila berbeda dari jam scan terakhir (di kanan).
      detail = `${v.kelompok} · ${STATUS_LABEL[v.status]}${e.count > 1 ? ` ${hhmm(e.firstAt)}` : ""}`;
      break;
    case "duplicate":
      title = v.name;
      detail = `${v.kelompok} · sudah tercatat${v.recordedAt ? ` ${hhmm(v.recordedAt)}` : ""} (${STATUS_LABEL[v.status]})`;
      break;
    case "unknown":
      title = "Kartu tidak dikenal";
      detail = "Bukan peserta agenda ini, atau kartunya sudah diganti.";
      break;
    case "invalid":
      title = "Bukan kartu Generus";
      detail = "QR yang terbaca bukan kartu dari aplikasi ini.";
      break;
    case "closed":
      title = "Tidak bisa mencatat";
      detail = v.reason;
      break;
  }
  const repeatsLabel = v.kind === "ok" ? `scan ulang ${e.count - 1}×` : `${e.count}×`;

  return (
    <li className={`flex items-center gap-3 px-3 py-2.5 ${latest ? "animate-enter bg-muted/40" : ""}`}>
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${TONE[tone].icon}`} aria-hidden>
        <Icon className="size-4" strokeWidth={2.5} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{title}</span>
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-xs tabular-nums text-muted-foreground" title={hhmmss(e.at)}>
          {hhmm(e.at)}
        </span>
        {e.count > 1 && (
          <span className={`rounded-full px-1.5 text-[11px] font-medium tabular-nums ${tone === "error" ? TONE.error.badge : TONE.repeat.badge}`}>{repeatsLabel}</span>
        )}
      </span>
    </li>
  );
}

/** Hasil scan terakhir (baris teratas riwayat). */
function FeedbackPanel({ feedback }: { feedback: LogEntry<ScanResult> | null }) {
  if (!feedback) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border px-4 py-6 text-center text-muted-foreground">
        Arahkan kamera ke kartu QR peserta
      </div>
    );
  }
  const r = feedback.last;
  const tone =
    r.kind === "ok"
      ? "border-status-hadir bg-status-hadir-soft text-foreground"
      : r.kind === "duplicate"
        ? "border-status-terlambat bg-status-terlambat-soft text-foreground"
        : "border-status-alpa bg-status-alpa-soft text-foreground";
  return (
    <div key={feedback.at} role="alert" className={`relative rounded-xl border-2 px-4 py-5 text-center ${tone}`}>
      {feedback.count > 1 && (
        <span className="absolute top-2 right-2.5 rounded-full bg-background/70 px-2 text-xs tabular-nums text-muted-foreground">discan {feedback.count}×</span>
      )}
      {r.kind === "ok" || r.kind === "duplicate" ? (
        <>
          <div className="font-heading text-2xl font-semibold">{r.name}</div>
          <div className="text-sm">
            {r.kelompok} · {r.kind === "ok" ? STATUS_LABEL[r.status] : duplicateText(r)}
          </div>
        </>
      ) : (
        <div className="text-lg font-semibold">{resultTitle(r)}</div>
      )}
    </div>
  );
}

function Camera({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"off" | "starting" | "on" | "error">("off");
  const [error, setError] = useState("");
  const stopRef = useRef<() => void>(() => {});

  const start = async () => {
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      const detector: QrDetector = await createQrDetector();
      let active = true;
      const loop = async () => {
        if (!active) return;
        try {
          if (video.readyState >= 2) for (const code of await detector.detect(video)) onCode(code);
        } catch {
          // Frame gagal dibaca: lanjut ke frame berikutnya.
        }
        setTimeout(loop, 250);
      };
      void loop();
      stopRef.current = () => {
        active = false;
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      };
      setState("on");
    } catch (e) {
      setState("error");
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Izin kamera ditolak. Izinkan kamera di pengaturan browser, atau pakai kolom kode di bawah."
          : "Kamera tidak bisa dibuka di perangkat ini. Pakai kolom kode atau cari nama.",
      );
    }
  };

  useEffect(() => () => stopRef.current(), []);

  return (
    <div className="flex flex-col gap-2">
      <div className={`relative overflow-hidden rounded-[20px] bg-black ${state === "on" || state === "starting" ? "aspect-square" : "hidden"}`}>
        <video ref={videoRef} className="size-full object-cover" playsInline muted />
        <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-[3px] border-white/85" />
      </div>
      {state === "on" ? (
        <Button variant="outline" onClick={() => (stopRef.current(), setState("off"))}>
          Matikan kamera
        </Button>
      ) : (
        <Button size="lg" onClick={() => void start()} disabled={state === "starting"}>
          {state === "starting" ? "Membuka kamera…" : "Mulai scan dengan kamera"}
        </Button>
      )}
      {state === "error" && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** Untuk scanner QR USB/Bluetooth (bekerja seperti keyboard + Enter) atau ketik manual. */
function ManualInput({ onCode }: { onCode: (code: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onCode(value);
        setValue("");
      }}
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Kode kartu (scanner USB / ketik)"
        aria-label="Kode kartu"
        className="rounded-full"
        autoComplete="off"
        autoCapitalize="characters"
      />
      <Button type="submit" variant="outline" className="rounded-full">
        Catat
      </Button>
    </form>
  );
}
