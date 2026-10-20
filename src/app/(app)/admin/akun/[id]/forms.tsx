"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UnitGroup } from "@/lib/accounts";
import { addRole, resetPassword, updateProfile, type AccountFormState } from "../actions";
import { FormAlert, RoleUnitFields, TempPasswordNotice } from "../components";

export function ProfileForm({ id, name, phone }: { id: string; name: string; phone: string | null }) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(updateProfile, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormAlert error={state.error} ok={state.ok} />
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nama lengkap</Label>
        <Input id="name" name="name" defaultValue={state.values?.name ?? name} required minLength={2} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">No. HP</Label>
        <Input id="phone" name="phone" type="tel" defaultValue={state.values?.phone ?? phone ?? ""} />
      </div>
      <Button type="submit" variant="outline" disabled={pending} className="w-fit">
        {pending ? "Menyimpan…" : "Simpan profil"}
      </Button>
    </form>
  );
}

export function AddRoleForm({ userId, unitGroups }: { userId: string; unitGroups: UnitGroup[] }) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(addRole, {});
  return (
    <form action={action} className="flex flex-col gap-3 border-t pt-4">
      <FormAlert error={state.error} ok={state.ok} />
      <input type="hidden" name="userId" value={userId} />
      <RoleUnitFields unitGroups={unitGroups} defaults={state.error ? state.values : undefined} />
      <Button type="submit" variant="outline" disabled={pending} className="w-fit">
        {pending ? "Menambahkan…" : "Tambah peran"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ id, email }: { id: string; email: string | null }) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(resetPassword, {});
  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        if (!confirm("Reset password akun ini? Password lama tidak bisa dipakai lagi.")) e.preventDefault();
      }}
    >
      <FormAlert error={state.error} />
      {state.tempPassword && <TempPasswordNotice email={email} password={state.tempPassword} />}
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="outline" disabled={pending} className="w-fit">
        {pending ? "Mereset…" : "Reset password"}
      </Button>
    </form>
  );
}
