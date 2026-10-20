"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { login, type FormState } from "@/app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const NOTICE: Record<string, string> = {
  nonaktif: "Akun Anda dinonaktifkan. Hubungi superadmin.",
};

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  const status = useSearchParams().get("status");
  const message = state.error ?? (status ? NOTICE[status] : undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      {message && (
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus defaultValue={state.email} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Masuk…" : "Masuk"}
        {!pending && <ArrowRight aria-hidden />}
      </Button>
    </form>
  );
}
