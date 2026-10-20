"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useOffline } from "next/offline";
import { downloadRoster } from "@/app/(app)/agenda/actions";
import { requestSync } from "@/components/outbox-sync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { offlineDb, saveRoster, type RosterItem } from "@/lib/offline/outbox";
import { processScan, recordBySearch, type ScanResult } from "@/lib/offline/scan";
import { beep, createQrDetector, type QrDetector } from "@/lib/qr-reader";

const STATUS_LABEL: Record<string, string> = { hadir: "Hadir", terlambat: "Terlambat", izin: "Izin", sakit: "Sakit", alpa: "Alpa" };
const SAME_CODE_COOLDOWN_MS = 3000;

interface Feedback {
  result: ScanResult;
  at: number;
}

export function Scanner() {
  const agendaId = useSearchParams().get("agenda") ?? "";
  const offline = useOffline();
  const [download, setDownload] = useState<{ state: "idle" | "loading" | "error"; message?: string }>({ state: "idle" });
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [recent, setRecent] = useState<Feedback[]>([]);
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
    const fb = { result, at: Date.now() };
    setFeedback(fb);
    setRecent((r) => [fb, ...r].slice(0, 12));
    beep(result.kind === "ok" ? "ok" : result.kind === "duplicate" ? "warn" : "error");
    if (result.kind === "ok") requestSync();
  }, []);

  const lastCode = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const handleCode = useCallback(
    async (raw: string) => {
      const now = Date.now();
      // Kamera membaca kode yang sama berkali-kali per detik: abaikan pengulangan singkat.
      if (raw === lastCode.current.code && now - lastCode.current.at < SAME_CODE_COOLDOWN_MS) return;
      lastCode.current = { code: raw, at: now };
      show(await processScan(agendaId, raw));
    },
    [agendaId, show],
  );

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

      <FeedbackPanel feedback={feedback} />

      {!agenda && download.state !== "loading" && (
        <p className="rounded-2xl bg-accent p-3 text-sm text-accent-foreground">
          {download.message ?? "Daftar peserta belum ada di perangkat ini. Buka halaman ini saat online untuk mengunduhnya."}
        </p>
      )}

      {agenda && (
        <>
          <Camera onCode={handleCode} />
          <ManualInput onCode={(c) => void handleCode(c)} />

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

      {recent.length > 0 && (
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-muted-foreground">Scan terakhir</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {recent.map((r) => (
              <li key={r.at} className="flex justify-between gap-2">
                <span>{resultTitle(r.result)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {new Date(r.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

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

function resultTitle(r: ScanResult): string {
  switch (r.kind) {
    case "ok":
      return `${r.name} — ${STATUS_LABEL[r.status]}`;
    case "duplicate":
      return `${r.name} — sudah tercatat (${STATUS_LABEL[r.status]})`;
    case "unknown":
      return "Kartu tidak dikenal / bukan peserta agenda ini";
    case "invalid":
      return "Bukan kartu Generus";
    case "closed":
      return r.reason;
  }
}

function FeedbackPanel({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border px-4 py-6 text-center text-muted-foreground">
        Arahkan kamera ke kartu QR peserta
      </div>
    );
  }
  const r = feedback.result;
  const tone =
    r.kind === "ok"
      ? "border-status-hadir bg-status-hadir-soft text-foreground"
      : r.kind === "duplicate"
        ? "border-status-terlambat bg-status-terlambat-soft text-foreground"
        : "border-status-alpa bg-status-alpa-soft text-foreground";
  return (
    <div key={feedback.at} role="alert" className={`rounded-xl border-2 px-4 py-5 text-center ${tone}`}>
      {r.kind === "ok" || r.kind === "duplicate" ? (
        <>
          <div className="font-heading text-2xl font-semibold">{r.name}</div>
          <div className="text-sm">
            {r.kelompok} · {r.kind === "ok" ? STATUS_LABEL[r.status] : `sudah tercatat (${STATUS_LABEL[r.status]})`}
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
