"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import type { JenjangOption, UnitOption } from "@/lib/generus";
import type { GenerusFormState } from "./actions";

export interface GenerusFormDefaults {
  id?: string;
  kelompokId?: string;
  name?: string;
  gender?: string;
  birthDate?: string;
  jenjangId?: string;
  kategoriId?: string | null;
  school?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  notes?: string | null;
}

export function GenerusForm({
  action,
  defaults,
  jenjang,
  kelompok,
  submitLabel,
}: {
  action: (prev: GenerusFormState, fd: FormData) => Promise<GenerusFormState>;
  defaults: GenerusFormDefaults;
  jenjang: JenjangOption[];
  /** Pilihan kelompok; kosongkan untuk form edit (kelompok diubah lewat mutasi). */
  kelompok?: UnitOption[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  // Setelah submit, nilai yang dikirim menjadi nilai awal baru (React mengosongkan form).
  const v: Record<string, string | null | undefined> = { ...defaults, ...state.values };
  return (
    <form key={state.values?._n} action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.ok && (
        <Alert>
          <AlertDescription>{state.ok}</AlertDescription>
        </Alert>
      )}
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        {kelompok && (
          <Field label="Kelompok" htmlFor="kelompokId" className="sm:col-span-2">
            <KelompokSelect options={kelompok} value={v.kelompokId ?? undefined} />
          </Field>
        )}
        <Field label="Nama lengkap" htmlFor="name" className="sm:col-span-2">
          <Input id="name" name="name" defaultValue={v.name ?? ""} required minLength={2} />
        </Field>
        <Field label="Jenis kelamin" htmlFor="gender">
          <NativeSelect id="gender" name="gender" defaultValue={v.gender ?? ""} required>
            <NativeSelectOption value="" disabled>
              Pilih
            </NativeSelectOption>
            <NativeSelectOption value="L">Laki-laki</NativeSelectOption>
            <NativeSelectOption value="P">Perempuan</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field label="Tanggal lahir" htmlFor="birthDate">
          <Input id="birthDate" name="birthDate" type="date" defaultValue={v.birthDate ?? ""} required />
        </Field>
        <JenjangFields jenjang={jenjang} jenjangId={v.jenjangId ?? undefined} kategoriId={v.kategoriId ?? undefined} />
        <Field label="Sekolah / kelas (opsional)" htmlFor="school" className="sm:col-span-2">
          <Input id="school" name="school" defaultValue={v.school ?? ""} placeholder="mis. SMPN 2 kelas 8" />
        </Field>
        <Field label="Nama orang tua/wali (opsional)" htmlFor="guardianName">
          <Input id="guardianName" name="guardianName" defaultValue={v.guardianName ?? ""} />
        </Field>
        <Field label="No. HP orang tua/wali (opsional)" htmlFor="guardianPhone">
          <Input id="guardianPhone" name="guardianPhone" type="tel" defaultValue={v.guardianPhone ?? ""} placeholder="08…" />
        </Field>
        <Field label="Catatan (opsional)" htmlFor="notes" className="sm:col-span-2">
          <Input id="notes" name="notes" defaultValue={v.notes ?? ""} />
        </Field>
      </div>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Menyimpan…" : submitLabel}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function JenjangFields({
  jenjang,
  jenjangId,
  kategoriId,
}: {
  jenjang: JenjangOption[];
  jenjangId?: string;
  kategoriId?: string;
}) {
  const [selected, setSelected] = useState(jenjangId ?? "");
  const kategori = jenjang.find((j) => j.id === selected)?.kategori ?? [];
  return (
    <>
      <Field label="Jenjang" htmlFor="jenjangId">
        <NativeSelect
          id="jenjangId"
          name="jenjangId"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          required
        >
          <NativeSelectOption value="" disabled>
            Pilih jenjang
          </NativeSelectOption>
          {jenjang.map((j) => (
            <NativeSelectOption key={j.id} value={j.id}>
              {j.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Kategori" htmlFor="kategoriId">
        <NativeSelect
          key={selected}
          id="kategoriId"
          name="kategoriId"
          defaultValue={kategori.some((k) => k.id === kategoriId) ? kategoriId : ""}
          required={kategori.length > 0}
          disabled={kategori.length === 0}
        >
          <NativeSelectOption value="">{kategori.length ? "Pilih kategori" : "Tidak ada (Pra Remaja)"}</NativeSelectOption>
          {kategori.map((k) => (
            <NativeSelectOption key={k.id} value={k.id}>
              {k.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </>
  );
}

export function KelompokSelect({ options, value, name = "kelompokId" }: { options: UnitOption[]; value?: string; name?: string }) {
  const byDesa = new Map<string, UnitOption[]>();
  for (const o of options) byDesa.set(o.desaName, [...(byDesa.get(o.desaName) ?? []), o]);
  return (
    <NativeSelect id={name} name={name} defaultValue={value ?? (options.length === 1 ? options[0].id : "")} required>
      <NativeSelectOption value="" disabled>
        Pilih kelompok
      </NativeSelectOption>
      {[...byDesa].map(([desa, opts]) => (
        <NativeSelectOptGroup key={desa} label={`Desa ${desa}`}>
          {opts.map((o) => (
            <NativeSelectOption key={o.id} value={o.id}>
              {o.name}
            </NativeSelectOption>
          ))}
        </NativeSelectOptGroup>
      ))}
    </NativeSelect>
  );
}
