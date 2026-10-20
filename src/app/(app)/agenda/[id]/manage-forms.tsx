"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { addScanner, cancelAgenda, lockAgenda, type AgendaFormState } from "../actions";

function Message({ state }: { state: AgendaFormState }) {
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

export function LockForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(lockAgenda, {});
  return (
    <form
      action={action}
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        if (!confirm("Kunci presensi sekarang? Peserta yang belum diisi menjadi alpa dan admin kelompok tidak bisa melengkapi lagi."))
          e.preventDefault();
      }}
    >
      <Message state={state} />
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="outline" size="sm" disabled={pending} className="w-fit">
        Kunci presensi sekarang
      </Button>
    </form>
  );
}

export function CancelForm({ id, recurring }: { id: string; recurring: boolean }) {
  const [state, action, pending] = useActionState(cancelAgenda, {});
  return (
    <form
      action={action}
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        if (!confirm("Batalkan agenda ini?")) e.preventDefault();
      }}
    >
      <Message state={state} />
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="scope" value="single" variant="ghost" size="sm" className="text-destructive" disabled={pending}>
          Batalkan agenda ini
        </Button>
        {recurring && (
          <Button type="submit" name="scope" value="series" variant="ghost" size="sm" className="text-destructive" disabled={pending}>
            Batalkan ini & pekan berikutnya
          </Button>
        )}
      </div>
    </form>
  );
}

export function AddScannerForm({ agendaId, candidates }: { agendaId: string; candidates: { id: string; name: string; email: string | null }[] }) {
  const [state, action, pending] = useActionState(addScanner, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <Message state={state} />
      <input type="hidden" name="agendaId" value={agendaId} />
      <div className="flex gap-2">
        <NativeSelect name="userId" required defaultValue="" aria-label="Akun petugas">
          <NativeSelectOption value="" disabled>
            Pilih akun
          </NativeSelectOption>
          {candidates.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
              {c.email ? ` (${c.email})` : ""}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          Tambah
        </Button>
      </div>
    </form>
  );
}
