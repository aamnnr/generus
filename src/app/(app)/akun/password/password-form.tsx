"use client";

import { PasswordInput } from "@/components/ui/password-input";
import { useActionState } from "react";
import { changePassword, type FormState } from "@/app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password baru</Label>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">Ulangi password baru</Label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={8} required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan password"}
      </Button>
    </form>
  );
}
