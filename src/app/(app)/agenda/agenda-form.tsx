"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import type { Segment } from "@/lib/agenda-target";
import type { AgendaFormState } from "./actions";

export interface AgendaUnitOption {
  id: string;
  name: string;
  level: "daerah" | "desa" | "kelompok";
  parentName: string | null;
}

export interface AgendaFormDefaults {
  id?: string;
  unitId?: string;
  title?: string;
  location?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  lateMinutes?: string;
  delegateDays?: string;
  gender?: string;
  segments?: string[];
}

const LEVEL = { daerah: "Daerah", desa: "Desa", kelompok: "Kelompok" } as const;

export function AgendaForm({
  action,
  units,
  segments,
  defaults,
  zone,
  allowRepeat,
  submitLabel,
}: {
  action: (prev: AgendaFormState, fd: FormData) => Promise<AgendaFormState>;
  units: AgendaUnitOption[];
  segments: Segment[];
  defaults: AgendaFormDefaults;
  zone: string;
  allowRepeat: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const v = { ...defaults, ...(state.values as AgendaFormDefaults | undefined) };
  const str = (x: unknown) => (typeof x === "string" ? x : undefined);
  const selectedSegments = new Set((v.segments as string[] | undefined) ?? segments.map((s) => s.key));

  const groups = new Map<string, AgendaUnitOption[]>();
  for (const u of units) {
    const label = u.level === "kelompok" ? `Kelompok di Desa ${u.parentName}` : LEVEL[u.level];
    groups.set(label, [...(groups.get(label) ?? []), u]);
  }

  return (
    <form key={str(state.values?._n)} action={formAction} className="flex flex-col gap-5">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Penyelenggara" htmlFor="unitId" className="sm:col-span-2">
          <NativeSelect id="unitId" name="unitId" required defaultValue={str(v.unitId) ?? (units.length === 1 ? units[0].id : "")}>
            <NativeSelectOption value="" disabled>
              Pilih daerah / desa / kelompok
            </NativeSelectOption>
            {[...groups].map(([label, opts]) => (
              <NativeSelectOptGroup key={label} label={label}>
                {opts.map((u) => (
                  <NativeSelectOption key={u.id} value={u.id}>
                    {LEVEL[u.level]} {u.name}
                  </NativeSelectOption>
                ))}
              </NativeSelectOptGroup>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Judul" htmlFor="title" className="sm:col-span-2">
          <Input id="title" name="title" required minLength={3} defaultValue={str(v.title)} placeholder="mis. Pengajian rutin remaja" />
        </Field>
        <Field label="Lokasi (opsional)" htmlFor="location" className="sm:col-span-2">
          <Input id="location" name="location" defaultValue={str(v.location)} placeholder="mis. Masjid Al-Ikhlas" />
        </Field>
        <Field label="Tanggal" htmlFor="date">
          <Input id="date" name="date" type="date" required defaultValue={str(v.date)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Mulai (${zone})`} htmlFor="startTime">
            <Input id="startTime" name="startTime" type="time" required defaultValue={str(v.startTime) ?? "19:30"} />
          </Field>
          <Field label={`Selesai (${zone})`} htmlFor="endTime">
            <Input id="endTime" name="endTime" type="time" required defaultValue={str(v.endTime) ?? "21:00"} />
          </Field>
        </div>
        <Field label="Terlambat bila datang lewat (menit)" htmlFor="lateMinutes">
          <Input id="lateMinutes" name="lateMinutes" type="number" min={0} max={240} required defaultValue={str(v.lateMinutes) ?? "15"} />
        </Field>
        <Field label="Admin kelompok boleh melengkapi presensi hingga (hari setelah selesai)" htmlFor="delegateDays">
          <Input id="delegateDays" name="delegateDays" type="number" min={0} max={14} required defaultValue={str(v.delegateDays) ?? "2"} />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Sasaran</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {segments.map((s) => (
            <label key={s.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="segments" value={s.key} defaultChecked={selectedSegments.has(s.key)} className="size-4 accent-primary" />
              {s.label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {[
            ["", "Laki-laki & perempuan"],
            ["L", "Laki-laki saja"],
            ["P", "Perempuan saja"],
          ].map(([val, label]) => (
            <label key={val} className="flex items-center gap-2">
              <input type="radio" name="gender" value={val} defaultChecked={(str(v.gender) ?? "") === val} className="size-4 accent-primary" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {allowRepeat && (
        <Field label="Ulangi setiap pekan" htmlFor="repeatWeeks" className="max-w-xs">
          <NativeSelect id="repeatWeeks" name="repeatWeeks" defaultValue={str((v as Record<string, unknown>).repeatWeeks) ?? "1"}>
            <NativeSelectOption value="1">Tidak (sekali saja)</NativeSelectOption>
            {[4, 8, 12, 26].map((n) => (
              <NativeSelectOption key={n} value={String(n)}>
                {n} pekan ({n === 26 ? "±6 bulan" : `±${Math.round(n / 4)} bulan`})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Menyimpan…" : submitLabel}
      </Button>
    </form>
  );
}

function Field({ label, htmlFor, className, children }: { label: string; htmlFor: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
