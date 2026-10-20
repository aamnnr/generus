"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UnitGroup } from "@/lib/accounts";
import { createAccount, type AccountFormState } from "../actions";
import { FormAlert, RoleUnitFields, TempPasswordNotice } from "../components";

export function CreateAccountForm({ unitGroups }: { unitGroups: UnitGroup[] }) {
  // Ganti key untuk memulai form baru yang kosong setelah akun dibuat.
  const [key, setKey] = useState(0);
  return <Form key={key} unitGroups={unitGroups} onReset={() => setKey((k) => k + 1)} />;
}

function Form({ unitGroups, onReset }: { unitGroups: UnitGroup[]; onReset: () => void }) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(createAccount, {});

  if (state.tempPassword && state.accountId) {
    return (
      <div className="flex flex-col gap-4">
        <FormAlert ok={state.ok} />
        <TempPasswordNotice email={state.email} password={state.tempPassword} />
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/akun/${state.accountId}`} className={buttonVariants({ variant: "outline" })}>
            Lihat akun
          </Link>
          <Button type="button" variant="ghost" onClick={onReset}>
            Tambah akun lain
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormAlert error={state.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="name">Nama lengkap</Label>
          <Input id="name" name="name" required minLength={2} defaultValue={state.values?.name} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required defaultValue={state.values?.email} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">No. HP (opsional)</Label>
          <Input id="phone" name="phone" type="tel" placeholder="08…" defaultValue={state.values?.phone} />
        </div>
      </div>
      <RoleUnitFields unitGroups={unitGroups} defaults={state.values} />
      <p className="text-xs text-muted-foreground">
        Peran tambahan (mis. Admin sekaligus Kyai) bisa ditambahkan di halaman detail akun setelah dibuat.
      </p>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Membuat…" : "Buat akun"}
      </Button>
    </form>
  );
}
