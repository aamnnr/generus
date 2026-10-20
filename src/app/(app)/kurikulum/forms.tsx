"use client";

import { useActionState, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  ASPEK_LABEL,
  ASPEK_ORDER,
  formatPosition,
  KITAB_UNIT_LABEL,
  parsePosition,
  type Aspek,
  type AssessmentMode,
  type KitabUnit,
} from "@/lib/kurikulum-format";
import {
  deletePeriod,
  deleteTarget,
  moveTarget,
  saveKitab,
  saveMateri,
  savePeriod,
  saveTarget,
  type KurikulumFormState,
} from "./actions";

// ---------------------------------------------------------------------------
// Bagian umum
// ---------------------------------------------------------------------------

function Field({ label, htmlFor, hint, className, children }: { label: string; htmlFor: string; hint?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Status({ state }: { state: KurikulumFormState }) {
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

const CHIP =
  "flex h-10 cursor-pointer items-center rounded-full border border-border bg-card px-4 text-sm font-medium has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50";

function Chips<T extends string>({
  name,
  options,
  value,
  defaultValue,
  onChange,
}: {
  name: string;
  options: [T, string][];
  value?: T;
  defaultValue?: T;
  onChange?: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <label key={v} className={CHIP}>
          <input
            type="radio"
            name={name}
            value={v}
            className="sr-only"
            {...(value !== undefined ? { checked: value === v, onChange: () => onChange?.(v) } : { defaultChecked: defaultValue === v })}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

const ASPEK_OPTIONS = ASPEK_ORDER.map((a) => [a, ASPEK_LABEL[a]] as [Aspek, string]);

function MapelInput({ aspek, suggestions, value, onChange, defaultValue }: { aspek: Aspek; suggestions: Record<Aspek, string[]>; value?: string; onChange?: (v: string) => void; defaultValue?: string }) {
  const listId = `mapel-${aspek}`;
  return (
    <>
      <Input
        id="mapel"
        name="mapel"
        list={listId}
        required
        minLength={2}
        placeholder="mis. Hafalan, Tata Krama"
        {...(value !== undefined ? { value, onChange: (e) => onChange?.(e.target.value) } : { defaultValue })}
      />
      <datalist id={listId}>
        {suggestions[aspek].map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
    </>
  );
}

/** Isian isi materi (dipakai di pustaka & "materi baru" pada target). */
function MateriContentFields({ v }: { v: Record<string, string | null | undefined> }) {
  return (
    <>
      <Field label="Judul materi" htmlFor="title" className="sm:col-span-2">
        <Input id="title" name="title" defaultValue={v.title ?? ""} placeholder="mis. Dalil Jamaah" />
      </Field>
      <Field label="Uraian (opsional)" htmlFor="body" className="sm:col-span-2" hint="Rincian poin, satu per baris.">
        <Textarea id="body" name="body" defaultValue={v.body ?? ""} rows={3} />
      </Field>
      <Field label="Teks Arab (opsional)" htmlFor="arabic" className="sm:col-span-2">
        <Textarea id="arabic" name="arabic" dir="rtl" lang="ar" defaultValue={v.arabic ?? ""} rows={2} className="font-arabic text-xl leading-loose md:text-xl" />
      </Field>
      <Field label="Terjemahan (opsional)" htmlFor="translation">
        <Textarea id="translation" name="translation" defaultValue={v.translation ?? ""} rows={2} />
      </Field>
      <Field label="Sumber (opsional)" htmlFor="source" hint="mis. QS Ali 'Imran 103, HR Abu Dawud">
        <Input id="source" name="source" defaultValue={v.source ?? ""} />
      </Field>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <span className="text-sm font-medium">Cara penilaian</span>
        <Chips<AssessmentMode>
          name="assessment"
          defaultValue={(v.assessment as AssessmentMode) || "generus"}
          options={[
            ["generus", "Per generus (belum/proses/tuntas)"],
            ["kelompok", "Per kelompok (sudah disampaikan)"],
          ]}
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Pustaka materi
// ---------------------------------------------------------------------------

export interface MateriDefaults {
  id?: string;
  aspek?: Aspek;
  mapel?: string;
  title?: string;
  body?: string | null;
  arabic?: string | null;
  translation?: string | null;
  source?: string | null;
  assessment?: AssessmentMode;
}

export function MateriForm({ defaults, mapelSuggestions }: { defaults: MateriDefaults; mapelSuggestions: Record<Aspek, string[]> }) {
  const [state, action, pending] = useActionState(saveMateri, {});
  const v = { ...defaults, ...state.values } as Record<string, string | null | undefined>;
  const [aspek, setAspek] = useState<Aspek>((v.aspek as Aspek) || "alim");
  return (
    <form key={state.values?._n} action={action} className="flex flex-col gap-4">
      <Status state={state} />
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-sm font-medium">Aspek</span>
          <Chips<Aspek> name="aspek" value={aspek} onChange={setAspek} options={ASPEK_OPTIONS} />
        </div>
        <Field label="Mata pelajaran" htmlFor="mapel" className="sm:col-span-2">
          <MapelInput aspek={aspek} suggestions={mapelSuggestions} defaultValue={v.mapel ?? ""} />
        </Field>
        <MateriContentFields v={v} />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-fit">
        {pending ? "Menyimpan…" : defaults.id ? "Simpan materi" : "Tambah materi"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Kitab
// ---------------------------------------------------------------------------

export function KitabForm({ defaults, onDone }: { defaults?: { id: string; title: string; unit: KitabUnit; total: number; sortOrder: number }; onDone?: () => void }) {
  const [state, action, pending] = useActionState<KurikulumFormState, FormData>(async (prev, fd) => {
    const res = await saveKitab(prev, fd);
    if (!res.error) onDone?.();
    return res;
  }, {});
  const v = { ...defaults, ...state.values } as Record<string, string | number | undefined>;
  return (
    <form key={String(state.values?._n ?? "")} action={action} className="flex flex-col gap-3">
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_160px_120px_90px]">
        <Field label="Nama kitab / lintasan" htmlFor={`title-${defaults?.id ?? "baru"}`}>
          <Input id={`title-${defaults?.id ?? "baru"}`} name="title" defaultValue={String(v.title ?? "")} required minLength={2} placeholder="mis. Makna Hadist K. Sholat" />
        </Field>
        <Field label="Satuan" htmlFor={`unit-${defaults?.id ?? "baru"}`}>
          <NativeSelect id={`unit-${defaults?.id ?? "baru"}`} name="unit" defaultValue={String(v.unit ?? "halaman")}>
            {(Object.keys(KITAB_UNIT_LABEL) as KitabUnit[]).map((u) => (
              <NativeSelectOption key={u} value={u}>
                {KITAB_UNIT_LABEL[u]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Jumlah" htmlFor={`total-${defaults?.id ?? "baru"}`}>
          <Input id={`total-${defaults?.id ?? "baru"}`} name="total" type="number" min={1} defaultValue={String(v.total ?? "")} required />
        </Field>
        <Field label="Urutan" htmlFor={`sort-${defaults?.id ?? "baru"}`}>
          <Input id={`sort-${defaults?.id ?? "baru"}`} name="sortOrder" type="number" min={0} defaultValue={String(v.sortOrder ?? 0)} />
        </Field>
      </div>
      <Status state={state} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : defaults ? "Simpan" : "Tambah kitab"}
        </Button>
        {defaults && onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Batal
          </Button>
        )}
      </div>
    </form>
  );
}

export function KitabEditToggle({ kitab, children }: { kitab: { id: string; title: string; unit: KitabUnit; total: number; sortOrder: number }; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <KitabForm defaults={kitab} onDone={() => setEditing(false)} />;
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">{children}</div>
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
        <Pencil aria-hidden /> Ubah
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Periode
// ---------------------------------------------------------------------------

export interface PeriodDefaults {
  id?: string;
  name?: string;
  semester?: string;
  startsOn?: string;
  endsOn?: string;
  copyFrom?: string;
}

export function PeriodForm({ defaults, copyOptions }: { defaults: PeriodDefaults; copyOptions?: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(savePeriod, {});
  const v = { ...defaults, ...state.values } as Record<string, string | undefined>;
  return (
    <form key={state.values?._n} action={action} className="flex flex-col gap-4">
      <Status state={state} />
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama periode" htmlFor="name" hint="Seperti di dokumen PPG, mis. Oktober 2026">
          <Input id="name" name="name" defaultValue={v.name ?? ""} required minLength={3} />
        </Field>
        <Field label="Semester" htmlFor="semester">
          <Input id="semester" name="semester" defaultValue={v.semester ?? ""} required placeholder="mis. 1 - 2026" />
        </Field>
        <Field label="Mulai" htmlFor="startsOn">
          <Input id="startsOn" name="startsOn" type="date" defaultValue={v.startsOn ?? ""} required />
        </Field>
        <Field label="Selesai" htmlFor="endsOn">
          <Input id="endsOn" name="endsOn" type="date" defaultValue={v.endsOn ?? ""} required />
        </Field>
        {copyOptions && (
          <Field label="Salin target dari" htmlFor="copyFrom" className="sm:col-span-2" hint="Semua target (semua jenjang) disalin; ubah yang berbeda sebelum diterbitkan.">
            <NativeSelect id="copyFrom" name="copyFrom" defaultValue={v.copyFrom ?? ""}>
              <NativeSelectOption value="">Mulai kosong</NativeSelectOption>
              {copyOptions.map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  Periode {p.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-fit">
        {pending ? "Menyimpan…" : defaults.id ? "Simpan periode" : "Buat periode"}
      </Button>
    </form>
  );
}

export function DeletePeriodButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(deletePeriod, {});
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button type="button" variant="outline" className="w-fit text-destructive" onClick={() => setConfirming(true)}>
        <Trash2 aria-hidden /> Hapus periode
      </Button>
    );
  }
  return (
    <form action={action} className="animate-enter flex flex-col gap-2 rounded-xl bg-status-alpa-soft p-3">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm font-semibold text-status-alpa">Hapus periode {name} beserta semua targetnya?</p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="destructive" disabled={pending}>
          {pending ? "Menghapus…" : "Ya, hapus periode"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Batal
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Target
// ---------------------------------------------------------------------------

export interface TargetFormData {
  periodId: string;
  jenjangId: string;
  kategori: { id: string; name: string }[];
  materi: { id: string; aspek: Aspek; mapel: string; title: string; assessment: AssessmentMode }[];
  kitab: { id: string; title: string; unit: KitabUnit; total: number }[];
  mapelSuggestions: Record<Aspek, string[]>;
  /** Strategi terakhir per "aspek|mapel" di jenjang ini, untuk isian otomatis. */
  strategies: Record<string, string>;
}

export interface TargetDefaults {
  id?: string;
  kind?: "materi" | "baru" | "kitab";
  aspek?: Aspek;
  mapel?: string;
  materiId?: string | null;
  kitabId?: string | null;
  from?: string;
  to?: string;
  note?: string | null;
  strategy?: string | null;
  kategoriId?: string | null;
  gender?: "L" | "P" | null;
  optional?: boolean;
}

export function TargetForm({ data, defaults, onDone }: { data: TargetFormData; defaults: TargetDefaults; onDone?: () => void }) {
  const [state, action, pending] = useActionState<KurikulumFormState, FormData>(async (prev, fd) => {
    const res = await saveTarget(prev, fd);
    if (!res.error && defaults.id) onDone?.();
    return res;
  }, {});
  const v = { ...defaults, ...state.values } as Record<string, string | boolean | null | undefined>;
  const s = (x: unknown) => (typeof x === "string" ? x : "");

  return <TargetFormInner key={s(state.values?._n)} data={data} v={v} s={s} defaults={defaults} state={state} action={action} pending={pending} onDone={onDone} />;
}

function TargetFormInner({
  data,
  v,
  s,
  defaults,
  state,
  action,
  pending,
  onDone,
}: {
  data: TargetFormData;
  v: Record<string, string | boolean | null | undefined>;
  s: (x: unknown) => string;
  defaults: TargetDefaults;
  state: KurikulumFormState;
  action: (fd: FormData) => void;
  pending: boolean;
  onDone?: () => void;
}) {
  const [kind, setKind] = useState<"materi" | "baru" | "kitab">((s(v.kind) as "materi") || "materi");
  const [aspek, setAspek] = useState<Aspek>((s(v.aspek) as Aspek) || "alim");
  const [mapel, setMapel] = useState(s(v.mapel));
  const [materiId, setMateriId] = useState(s(v.materiId));
  const [strategy, setStrategy] = useState(s(v.strategy) || data.strategies[`${s(v.aspek) || "alim"}|${s(v.mapel)}`] || "");
  const [kitabId, setKitabId] = useState(s(v.kitabId) || data.kitab[0]?.id || "");
  const [from, setFrom] = useState(s(v.from));
  const [to, setTo] = useState(s(v.to));
  const k = data.kitab.find((x) => x.id === kitabId);

  const changeMapel = (next: string, nextAspek = aspek) => {
    setMapel(next);
    const known = data.strategies[`${nextAspek}|${next}`];
    if (known && !strategy) setStrategy(known);
  };
  const pickMateri = (id: string) => {
    setMateriId(id);
    const m = data.materi.find((x) => x.id === id);
    if (m) {
      setAspek(m.aspek);
      changeMapel(m.mapel, m.aspek);
    }
  };

  const materiOptions = data.materi.filter((m) => m.aspek === aspek);
  const byMapel = new Map<string, typeof materiOptions>();
  for (const m of materiOptions) byMapel.set(m.mapel, [...(byMapel.get(m.mapel) ?? []), m]);

  const preview = (text: string) => {
    if (!k || !text.trim()) return null;
    const pos = parsePosition(k.unit, text, k.total);
    return pos ? <span className="text-status-hadir">✓ {formatPosition(k.unit, pos)}</span> : <span className="text-destructive">Tidak dikenali</span>;
  };
  const idp = defaults.id ?? "baru";

  return (
    <form action={action} className="flex flex-col gap-4">
      <Status state={state} />
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <input type="hidden" name="periodId" value={data.periodId} />
      <input type="hidden" name="jenjangId" value={data.jenjangId} />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Jenis target</span>
        <Chips
          name="kind"
          value={kind}
          onChange={setKind}
          options={[
            ["materi", "Materi dari pustaka"],
            ["baru", "Materi baru"],
            ["kitab", "Rentang kitab"],
          ]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Aspek" htmlFor={`aspek-${idp}`}>
          <NativeSelect id={`aspek-${idp}`} name="aspek" value={aspek} onChange={(e) => setAspek(e.target.value as Aspek)}>
            {ASPEK_OPTIONS.map(([a, label]) => (
              <NativeSelectOption key={a} value={a}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Mata pelajaran" htmlFor="mapel">
          <MapelInput aspek={aspek} suggestions={data.mapelSuggestions} value={mapel} onChange={(x) => changeMapel(x)} />
        </Field>

        {kind === "materi" && (
          <Field label="Materi" htmlFor={`materiId-${idp}`} className="sm:col-span-2" hint={materiOptions.length === 0 ? "Belum ada materi untuk aspek ini; pilih “Materi baru”." : undefined}>
            <NativeSelect id={`materiId-${idp}`} name="materiId" value={materiId} onChange={(e) => pickMateri(e.target.value)} required>
              <NativeSelectOption value="" disabled>
                Pilih materi
              </NativeSelectOption>
              {[...byMapel].map(([mp, items]) => (
                <NativeSelectOptGroup key={mp} label={mp}>
                  {items.map((m) => (
                    <NativeSelectOption key={m.id} value={m.id}>
                      {m.title}
                      {m.assessment === "kelompok" ? " · per kelompok" : ""}
                    </NativeSelectOption>
                  ))}
                </NativeSelectOptGroup>
              ))}
            </NativeSelect>
          </Field>
        )}

        {kind === "baru" && <MateriContentFields v={v as Record<string, string | null | undefined>} />}

        {kind === "kitab" && (
          <>
            <Field label="Kitab" htmlFor={`kitabId-${idp}`} className="sm:col-span-2">
              <NativeSelect id={`kitabId-${idp}`} name="kitabId" value={kitabId} onChange={(e) => setKitabId(e.target.value)} required>
                {data.kitab.map((x) => (
                  <NativeSelectOption key={x.id} value={x.id}>
                    {x.title} · {x.total.toLocaleString("id-ID")} {x.unit === "halaman" ? "hal" : x.unit}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Dari" htmlFor={`from-${idp}`} hint={preview(from)}>
              <Input id={`from-${idp}`} name="from" value={from} onChange={(e) => setFrom(e.target.value)} required placeholder={k?.unit === "ayat" ? "mis. Al-Baqarah 253" : "mis. 26"} />
            </Field>
            <Field label="Sampai" htmlFor={`to-${idp}`} hint={preview(to)}>
              <Input id={`to-${idp}`} name="to" value={to} onChange={(e) => setTo(e.target.value)} required placeholder={k?.unit === "ayat" ? "mis. Ali Imron 91" : "mis. 38"} />
            </Field>
            <Field label="Keterangan (opsional)" htmlFor={`note-${idp}`} className="sm:col-span-2" hint="mis. Juz 3">
              <Input id={`note-${idp}`} name="note" defaultValue={s(v.note)} />
            </Field>
          </>
        )}

        <Field label="Strategi pembelajaran (opsional)" htmlFor={`strategy-${idp}`} className="sm:col-span-2" hint="Terisi otomatis dari target lain dengan mapel yang sama.">
          <Textarea id={`strategy-${idp}`} name="strategy" value={strategy} onChange={(e) => setStrategy(e.target.value)} rows={2} placeholder="mis. Disampaikan dalam KBM @ 2 x sebulan" />
        </Field>

        {data.kategori.length > 0 && (
          <Field label="Kategori" htmlFor={`kategoriId-${idp}`}>
            <NativeSelect id={`kategoriId-${idp}`} name="kategoriId" defaultValue={s(v.kategoriId)}>
              <NativeSelectOption value="">Semua kategori</NativeSelectOption>
              {data.kategori.map((x) => (
                <NativeSelectOption key={x.id} value={x.id}>
                  {x.name} saja
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Sasaran</span>
          <Chips
            name="gender"
            defaultValue={(s(v.gender) as "" | "L" | "P") || ""}
            options={[
              ["", "Putra & putri"],
              ["L", "Putra"],
              ["P", "Putri"],
            ]}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="optional" defaultChecked={v.optional === true || v.optional === "on"} className="size-4 accent-primary" />
        Bersifat pilihan/extra (tidak dihitung dalam persentase capaian)
      </label>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="w-full sm:w-fit">
          {pending ? "Menyimpan…" : defaults.id ? "Simpan target" : "Tambah target"}
        </Button>
        {defaults.id && onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Batal
          </Button>
        )}
      </div>
    </form>
  );
}

/** Tombol urut/ubah/hapus pada satu baris target, dengan form ubah yang terbuka di tempat. */
export function TargetRowEditor({ data, defaults, first, last, children }: { data: TargetFormData; defaults: TargetDefaults; first: boolean; last: boolean; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [busy, start] = useTransition();
  const id = defaults.id!;
  const run = (fn: () => Promise<unknown>) => start(async () => void (await fn()));

  if (editing) {
    return (
      <div className="animate-enter rounded-xl border border-primary/30 bg-background p-3">
        <TargetForm data={data} defaults={defaults} onDone={() => setEditing(false)} />
      </div>
    );
  }
  const fd = (extra: Record<string, string>) => {
    const f = new FormData();
    f.set("id", id);
    for (const [k, val] of Object.entries(extra)) f.set(k, val);
    return f;
  };
  if (confirming) {
    return (
      <div className="animate-enter flex flex-col gap-2 rounded-xl bg-status-alpa-soft p-3">
        <div className="opacity-70">{children}</div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-status-alpa">Hapus target ini?</span>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const res = await deleteTarget(fd({}));
                setError(res.error);
                setConfirming(false);
              })
            }
          >
            {busy ? "Menghapus…" : "Ya, hapus"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Batal
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        {children}
        {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 print:hidden" aria-busy={busy}>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Naikkan" disabled={first || busy} onClick={() => run(() => moveTarget(fd({ dir: "up" })))}>
          <ArrowUp aria-hidden />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Turunkan" disabled={last || busy} onClick={() => run(() => moveTarget(fd({ dir: "down" })))}>
          <ArrowDown aria-hidden />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Ubah target" onClick={() => setEditing(true)}>
          <Pencil aria-hidden />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Hapus target" className="text-destructive" disabled={busy} onClick={() => setConfirming(true)}>
          <Trash2 aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** Lipat/buka form tambah target. */
export function AddTargetPanel({ data }: { data: TargetFormData }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="outline" className="w-full sm:w-fit" onClick={() => setOpen(true)}>
        + Tambah target
      </Button>
    );
  }
  return (
    <div className="animate-enter flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-card md:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Tambah target</h2>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Tutup
        </Button>
      </div>
      <TargetForm data={data} defaults={{}} />
    </div>
  );
}


/** Panel yang bisa dibuka/tutup (mis. pengaturan periode). */
export function Collapsible({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" className="w-full sm:w-fit" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? `Tutup ${label.toLowerCase()}` : label}
      </Button>
      {open && <div className="animate-enter">{children}</div>}
    </div>
  );
}
