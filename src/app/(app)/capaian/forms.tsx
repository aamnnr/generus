"use client";

import { useActionState, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { useReportPending } from "@/components/nav/pending-store";
import { TAB_TRANSITION } from "@/lib/transitions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { CAPAIAN_LABEL, formatPosition, kitabStatus, parsePosition, type CapaianStatus, type KitabUnit } from "@/lib/kurikulum-format";
import { saveAchievements, saveKitabProgress, setDelivery, type CapaianState } from "./actions";

function Status({ state }: { state: CapaianState }) {
  if (state.error)
    return (
      <Alert variant="destructive">
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  if (state.ok)
    return (
      <Alert>
        <AlertDescription>{state.ok}</AlertDescription>
      </Alert>
    );
  return null;
}

// ---------------------------------------------------------------------------
// Pilihan periode / kelompok (mengubah query string)
// ---------------------------------------------------------------------------

export function QuerySelect({
  name,
  label,
  value,
  options,
  groups,
}: {
  name: string;
  label: string;
  value: string;
  options?: { value: string; label: string }[];
  groups?: { label: string; options: { value: string; label: string }[] }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  useReportPending(pending);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
      <Label htmlFor={`q-${name}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <NativeSelect
        id={`q-${name}`}
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          next.set(name, e.target.value);
          startTransition(() => router.push(`${pathname}?${next}`, { scroll: false, transitionTypes: [TAB_TRANSITION] }));
        }}
      >
        {options?.map((o) => (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ))}
        {groups?.map((g) => (
          <NativeSelectOptGroup key={g.label} label={g.label}>
            {g.options.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
        ))}
      </NativeSelect>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pilihan status belum / proses / tuntas
// ---------------------------------------------------------------------------

const TONE: Record<CapaianStatus, string> = {
  belum: "has-checked:bg-muted-foreground has-checked:border-muted-foreground",
  proses: "has-checked:bg-status-terlambat has-checked:border-status-terlambat",
  tuntas: "has-checked:bg-status-hadir has-checked:border-status-hadir",
};

export function StatusChips({ name, value, onChange, label }: { name: string; value: CapaianStatus; onChange: (v: CapaianStatus) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0 gap-1">
      {(["belum", "proses", "tuntas"] as const).map((s) => (
        <label
          key={s}
          className={`flex h-9 cursor-pointer items-center rounded-full border border-border bg-card px-3 text-[13px] font-medium has-checked:text-white has-focus-visible:ring-3 has-focus-visible:ring-ring/50 ${TONE[s]}`}
        >
          <input type="radio" name={name} value={s} checked={value === s} onChange={() => onChange(s)} className="sr-only" />
          {CAPAIAN_LABEL[s]}
        </label>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checklist capaian satu target (massal per materi)
// ---------------------------------------------------------------------------

export interface ChecklistRow {
  generusId: string;
  name: string;
  meta: string;
  status: CapaianStatus;
  aktif: boolean;
}

export function AchievementChecklist({ targetId, rows }: { targetId: string; rows: ChecklistRow[] }) {
  // Hanya simpan yang diubah; sisanya mengikuti data server terbaru.
  const [edits, setEdits] = useState<Record<string, CapaianStatus>>({});
  const [state, action, pending] = useActionState<CapaianState, FormData>(async (prev, fd) => {
    const res = await saveAchievements(prev, fd);
    if (!res.error) setEdits({});
    return res;
  }, {});
  const values: Record<string, CapaianStatus> = Object.fromEntries(rows.map((r) => [r.generusId, edits[r.generusId] ?? r.status]));

  const changed = rows.filter((r) => values[r.generusId] !== r.status);
  const set = (id: string, s: CapaianStatus) => setEdits((v) => ({ ...v, [id]: s }));
  const count = (s: CapaianStatus) => rows.filter((r) => values[r.generusId] === s).length;

  return (
    <form action={action} className="flex flex-col gap-3">
      <Status state={state} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {count("tuntas")} tuntas · {count("proses")} proses · {count("belum")} belum
        </span>
        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setEdits(Object.fromEntries(rows.map((r) => [r.generusId, "tuntas" as const])))}>
            <Check aria-hidden /> Semua tuntas
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEdits({})} disabled={changed.length === 0}>
            Urungkan
          </Button>
        </div>
      </div>
      {changed.map((r) => (
        <input key={r.generusId} type="hidden" name={`s:${targetId}:${r.generusId}`} value={values[r.generusId]} />
      ))}
      <ul className="overflow-hidden rounded-2xl bg-card shadow-card">
        {rows.map((r, i) => (
          <li
            key={r.generusId}
            className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 ${i < rows.length - 1 ? "border-b border-muted" : ""} ${
              values[r.generusId] !== r.status ? "bg-accent/40" : ""
            }`}
          >
            <span className="flex min-w-0 flex-[1_1_180px] flex-col">
              <span className="font-medium">{r.name}</span>
              <span className="text-xs text-muted-foreground">
                {r.meta}
                {!r.aktif && " · sudah tidak aktif"}
              </span>
            </span>
            <StatusChips name={`ui-${r.generusId}`} label={`Capaian ${r.name}`} value={values[r.generusId]} onChange={(s) => set(r.generusId, s)} />
          </li>
        ))}
      </ul>
      <div className="sticky bottom-24 z-10 flex justify-end lg:bottom-4">
        <Button type="submit" size="lg" disabled={pending || changed.length === 0} className="shadow-float">
          {pending ? "Menyimpan…" : changed.length ? `Simpan ${changed.length} perubahan` : "Belum ada perubahan"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Tanda "sudah disampaikan" (target per kelompok)
// ---------------------------------------------------------------------------

export function DeliveryToggle({ targetId, kelompokId, deliveredOn, today }: { targetId: string; kelompokId: string; deliveredOn: string | null; today: string }) {
  const [state, action, pending] = useActionState(setDelivery, {});
  const [date, setDate] = useState(today);
  const label = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

  if (deliveredOn) {
    return (
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="kelompokId" value={kelompokId} />
        <input type="hidden" name="delivered" value="0" />
        <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-status-hadir-soft px-3 text-[13px] font-semibold text-status-hadir">
          <Check className="size-4" aria-hidden /> Disampaikan {label(deliveredOn)}
        </span>
        <Button type="submit" size="xs" variant="ghost" className="text-muted-foreground" disabled={pending}>
          Batalkan
        </Button>
        {state.error && <span className="text-sm text-destructive">{state.error}</span>}
      </form>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="kelompokId" value={kelompokId} />
      <input type="hidden" name="delivered" value="1" />
      <Input type="date" name="deliveredOn" value={date} max={today} onChange={(e) => setDate(e.target.value)} aria-label="Tanggal disampaikan" className="h-9 w-40 md:h-9" />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Menyimpan…" : "Tandai disampaikan"}
      </Button>
      {state.error && <span className="text-sm text-destructive">{state.error}</span>}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Progres kitab massal
// ---------------------------------------------------------------------------

export interface KitabRosterRow {
  generusId: string;
  name: string;
  meta: string;
  position: number | null;
  recordedOn: string | null;
}

export function KitabBulkForm({
  kitab,
  range,
  rows,
  today,
}: {
  kitab: { id: string; title: string; unit: KitabUnit; total: number };
  range: { from: number; to: number };
  rows: KitabRosterRow[];
  today: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [position, setPosition] = useState("");
  const [state, action, pending] = useActionState<CapaianState, FormData>(async (prev, fd) => {
    const res = await saveKitabProgress(prev, fd);
    if (!res.error) {
      setSelected(new Set());
      setPosition("");
    }
    return res;
  }, {});

  const parsed = position.trim() ? parsePosition(kitab.unit, position, kitab.total) : null;
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const notDone = rows.filter((r) => kitabStatus(r.position, range.from, range.to) !== "tuntas").map((r) => r.generusId);
  const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="kitabId" value={kitab.id} />
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="generusIds" value={id} />
      ))}
      <Status state={state} />

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setSelected(new Set(rows.map((r) => r.generusId)))}>
          Pilih semua
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setSelected(new Set(notDone))} disabled={notDone.length === 0}>
          Pilih yang belum tuntas
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
          Kosongkan
        </Button>
      </div>

      <ul className="overflow-hidden rounded-2xl bg-card shadow-card">
        {rows.map((r, i) => {
          const s = kitabStatus(r.position, range.from, range.to);
          return (
            <li key={r.generusId} className={i < rows.length - 1 ? "border-b border-muted" : ""}>
              <label className={`flex cursor-pointer items-center gap-3 px-4 py-3 ${selected.has(r.generusId) ? "bg-secondary/60" : ""}`}>
                <input type="checkbox" checked={selected.has(r.generusId)} onChange={() => toggle(r.generusId)} className="size-5 accent-primary" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground">{r.meta}</span>
                </span>
                <span className="flex flex-col items-end text-right">
                  <span className={`text-sm font-semibold ${s === "tuntas" ? "text-status-hadir" : s === "proses" ? "text-status-terlambat" : "text-muted-foreground"}`}>
                    {r.position ? formatPosition(kitab.unit, r.position) : "Belum ada"}
                  </span>
                  {r.recordedOn && <span className="text-xs text-muted-foreground">{fmtDate(r.recordedOn)}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-24 z-10 flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-float lg:bottom-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="position">Posisi terakhir yang dicapai</Label>
            <Input
              id="position"
              name="position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder={kitab.unit === "ayat" ? "mis. Al-Baqarah 280" : `halaman 1–${kitab.total}`}
              inputMode={kitab.unit === "ayat" ? "text" : "numeric"}
            />
            {position.trim() && (
              <span className={`text-xs ${parsed ? "text-status-hadir" : "text-destructive"}`}>
                {parsed ? `✓ ${formatPosition(kitab.unit, parsed)}` : "Tidak dikenali"}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recordedOn">Tanggal</Label>
            <Input id="recordedOn" name="recordedOn" type="date" defaultValue={today} max={today} />
          </div>
        </div>
        <Button type="submit" disabled={pending || selected.size === 0 || !parsed}>
          {pending ? "Menyimpan…" : selected.size ? `Catat untuk ${selected.size} generus` : "Pilih generus dulu"}
        </Button>
      </div>
    </form>
  );
}

/** Catat posisi kitab satu generus (di halaman capaian per generus). */
export function KitabSingleForm({ kitab, generusId, today }: { kitab: { id: string; unit: KitabUnit; total: number }; generusId: string; today: string }) {
  const [position, setPosition] = useState("");
  const [state, action, pending] = useActionState<CapaianState, FormData>(async (prev, fd) => {
    const res = await saveKitabProgress(prev, fd);
    if (!res.error) setPosition("");
    return res;
  }, {});
  const parsed = position.trim() ? parsePosition(kitab.unit, position, kitab.total) : null;
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="kitabId" value={kitab.id} />
      <input type="hidden" name="generusIds" value={generusId} />
      <input type="hidden" name="recordedOn" value={today} />
      <div className="flex gap-2">
        <Input
          name="position"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          aria-label="Posisi terakhir"
          placeholder={kitab.unit === "ayat" ? "Posisi terakhir, mis. Al-Baqarah 280" : "Halaman terakhir"}
          className="h-9 md:h-9"
        />
        <Button type="submit" size="sm" disabled={pending || !parsed}>
          Catat
        </Button>
      </div>
      {position.trim() && (
        <span className={`text-xs ${parsed ? "text-status-hadir" : "text-destructive"}`}>{parsed ? `✓ ${formatPosition(kitab.unit, parsed)}` : "Tidak dikenali"}</span>
      )}
      {state.error && <span className="text-sm text-destructive">{state.error}</span>}
      {state.ok && <span className="text-sm text-muted-foreground">{state.ok}</span>}
    </form>
  );
}

/** Daftar status materi per generus untuk satu generus (satu tombol simpan). */
export function GenerusAchievementForm({ generusId, items }: { generusId: string; items: { targetId: string; status: CapaianStatus; label: React.ReactNode }[] }) {
  const [edits, setEdits] = useState<Record<string, CapaianStatus>>({});
  const [state, action, pending] = useActionState<CapaianState, FormData>(async (prev, fd) => {
    const res = await saveAchievements(prev, fd);
    if (!res.error) setEdits({});
    return res;
  }, {});
  const values: Record<string, CapaianStatus> = Object.fromEntries(items.map((i) => [i.targetId, edits[i.targetId] ?? i.status]));
  const changed = items.filter((i) => values[i.targetId] !== i.status);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Status state={state} />
      {changed.map((i) => (
        <input key={i.targetId} type="hidden" name={`s:${i.targetId}:${generusId}`} value={values[i.targetId]} />
      ))}
      <ul className="flex flex-col divide-y divide-muted">
        {items.map((i) => (
          <li key={i.targetId} className={`flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 ${values[i.targetId] !== i.status ? "bg-accent/40" : ""}`}>
            <span className="min-w-0 flex-[1_1_200px] text-sm">{i.label}</span>
            <StatusChips name={`ui-${i.targetId}`} label="Status" value={values[i.targetId]} onChange={(s) => setEdits((v) => ({ ...v, [i.targetId]: s }))} />
          </li>
        ))}
      </ul>
      <Button type="submit" disabled={pending || changed.length === 0} className="w-full sm:w-fit">
        {pending ? "Menyimpan…" : changed.length ? `Simpan ${changed.length} perubahan` : "Belum ada perubahan"}
      </Button>
    </form>
  );
}
