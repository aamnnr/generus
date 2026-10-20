"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addUnit, deleteUnit, renameUnit, type WilayahFormState } from "./actions";

function Message({ state }: { state: WilayahFormState }) {
  if (state.error) return <p className="text-sm text-destructive">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-muted-foreground">{state.ok}</p>;
  return null;
}

export function AddUnitForm({ parentId, level }: { parentId: string; level: "desa" | "kelompok" }) {
  const [state, action, pending] = useActionState<WilayahFormState, FormData>(addUnit, {});
  const label = level === "desa" ? "desa" : "kelompok";
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="parentId" value={parentId} />
      <input type="hidden" name="level" value={level} />
      <div className="flex gap-2">
        <Input name="name" placeholder={`Nama ${label} baru`} required minLength={2} aria-label={`Nama ${label} baru`} />
        <Button type="submit" variant="outline" disabled={pending}>
          Tambah {label}
        </Button>
      </div>
      <Message state={state} />
    </form>
  );
}

export function UnitRow({
  id,
  name,
  label,
  count,
  deletable,
  heading,
}: {
  id: string;
  name: string;
  label: string;
  count: number;
  deletable: boolean;
  heading?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [renameState, rename, renaming] = useActionState<WilayahFormState, FormData>(
    async (prev, fd) => {
      const res = await renameUnit(prev, fd);
      if (!res.error) setEditing(false);
      return res;
    },
    {},
  );
  const [deleteState, remove, deleting] = useActionState<WilayahFormState, FormData>(deleteUnit, {});

  if (editing) {
    return (
      <form action={rename} className="flex flex-col gap-2 py-1">
        <input type="hidden" name="id" value={id} />
        <div className="flex gap-2">
          <Input name="name" defaultValue={name} required minLength={2} autoFocus aria-label={`Nama ${label}`} />
          <Button type="submit" size="sm" disabled={renaming}>
            Simpan
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Batal
          </Button>
        </div>
        <Message state={renameState} />
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-1">
      <div className="flex items-center gap-2">
        <span className={heading ? "text-base font-semibold" : "text-sm"}>
          {heading ? `${label} ${name}` : name}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{count.toLocaleString("id-ID")} generus</span>
        <div className="ml-auto flex gap-1">
          <Button type="button" size="xs" variant="ghost" onClick={() => setEditing(true)}>
            Ubah nama
          </Button>
          {deletable && (
            <form
              action={remove}
              onSubmit={(e) => {
                if (!confirm(`Hapus ${label.toLowerCase()} ${name}?`)) e.preventDefault();
              }}
            >
              <input type="hidden" name="id" value={id} />
              <Button type="submit" size="xs" variant="ghost" className="text-destructive" disabled={deleting}>
                Hapus
              </Button>
            </form>
          )}
        </div>
      </div>
      <Message state={deleteState} />
      {renameState.ok && <Message state={renameState} />}
    </div>
  );
}
