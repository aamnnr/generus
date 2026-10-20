"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { UnitOption } from "@/lib/generus";
import { changeStatus, deleteGenerus, mutateGenerus, type GenerusFormState } from "../actions";
import { KelompokSelect } from "../generus-form";

function Message({ state }: { state: GenerusFormState }) {
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

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Tandai Menikah / Pindah Sambung. */
export function StatusForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(changeStatus, {});
  const [today] = useState(todayLocal);
  return (
    <form
      key={state.values?._n}
      action={action}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        if (!confirm("Generus ini tidak akan dihitung lagi di agenda & target, dan kartu QR-nya nonaktif. Lanjutkan?"))
          e.preventDefault();
      }}
    >
      <Message state={state} />
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Status baru</Label>
          <NativeSelect id="status" name="status" required defaultValue={state.values?.status ?? ""}>
            <NativeSelectOption value="" disabled>
              Pilih
            </NativeSelectOption>
            <NativeSelectOption value="menikah">Menikah</NativeSelectOption>
            <NativeSelectOption value="pindah_sambung">Pindah Sambung (keluar daerah)</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="statusDate">Tanggal</Label>
          <Input id="statusDate" name="statusDate" type="date" max={today} defaultValue={state.values?.statusDate ?? today} required />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="statusNote">Keterangan (opsional)</Label>
          <Input id="statusNote" name="statusNote" defaultValue={state.values?.statusNote ?? ""} placeholder="mis. pindah ke Daerah X" />
        </div>
      </div>
      <Button type="submit" variant="outline" disabled={pending} className="w-fit">
        Simpan status
      </Button>
    </form>
  );
}

export function ReactivateForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(changeStatus, {});
  const [today] = useState(todayLocal);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Message state={state} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value="aktif" />
      <input type="hidden" name="statusDate" value={today} />
      <Button type="submit" variant="outline" disabled={pending} className="w-fit">
        Aktifkan kembali
      </Button>
    </form>
  );
}

export function MutateForm({ id, options, currentKelompokId }: { id: string; options: UnitOption[]; currentKelompokId: string }) {
  const [state, action, pending] = useActionState(mutateGenerus, {});
  const targets = options.filter((o) => o.id !== currentKelompokId);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Message state={state} />
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="mutasi-kelompok">Kelompok tujuan</Label>
        <KelompokSelect options={targets} name="kelompokId" />
      </div>
      <Button type="submit" variant="outline" disabled={pending || targets.length === 0} className="w-fit">
        Pindahkan
      </Button>
    </form>
  );
}

export function DeleteForm({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(deleteGenerus, {});
  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        if (!confirm(`Hapus permanen data ${name}? Gunakan hanya untuk data yang salah input.`)) e.preventDefault();
      }}
    >
      <Message state={state} />
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="destructive" disabled={pending} className="w-fit">
        Hapus data
      </Button>
    </form>
  );
}
