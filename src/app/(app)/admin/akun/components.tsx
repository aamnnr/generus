"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import type { UnitGroup } from "@/lib/accounts";

const LEVEL_PREFIX = { daerah: "Daerah", desa: "Desa", kelompok: "Kelompok" } as const;

export function RoleUnitFields({
  unitGroups,
  defaults,
}: {
  unitGroups: UnitGroup[];
  defaults?: Record<string, string>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="role">Peran</Label>
        {/* key: pasang ulang agar nilai terakhir terpilih lagi setelah form di-reset React. */}
        <NativeSelect key={`role-${defaults?._n}`} id="role" name="role" required defaultValue={defaults?.role ?? ""}>
          <NativeSelectOption value="" disabled>
            Pilih peran
          </NativeSelectOption>
          <NativeSelectOption value="admin">Admin</NativeSelectOption>
          <NativeSelectOption value="kyai">Kyai (hanya melihat)</NativeSelectOption>
          <NativeSelectOption value="kurikulum">Tim Kurikulum (unit daerah)</NativeSelectOption>
          <NativeSelectOption value="superadmin">Superadmin (unit daerah)</NativeSelectOption>
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="unitId">Unit</Label>
        <NativeSelect key={`unit-${defaults?._n}`} id="unitId" name="unitId" required defaultValue={defaults?.unitId ?? ""}>
          <NativeSelectOption value="" disabled>
            Pilih unit
          </NativeSelectOption>
          {unitGroups.map((g) => (
            <NativeSelectOptGroup key={g.label} label={g.label}>
              {g.options.map((u) => (
                <NativeSelectOption key={u.id} value={u.id}>
                  {LEVEL_PREFIX[u.level]} {u.name}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}

export function FormAlert({ error, ok }: { error?: string; ok?: string }) {
  if (error)
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  if (ok)
    return (
      <Alert>
        <AlertDescription>{ok}</AlertDescription>
      </Alert>
    );
  return null;
}

/** Menampilkan password sementara sekali, dengan tombol salin. */
export function TempPasswordNotice({ email, password }: { email?: string | null; password: string }) {
  const [copied, setCopied] = useState(false);
  const text = email ? `Email: ${email}\nPassword sementara: ${password}` : `Password sementara: ${password}`;
  return (
    <Alert>
      <AlertTitle>Password sementara</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>
          Kirimkan ke pemilik akun (mis. lewat WhatsApp pribadi). Password ini hanya ditampilkan sekali dan wajib
          diganti saat pertama login.
        </p>
        <code className="w-fit rounded-md bg-muted px-3 py-2 font-mono text-base tracking-wider text-foreground">
          {password}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          }}
        >
          {copied ? "Tersalin" : "Salin email & password"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
