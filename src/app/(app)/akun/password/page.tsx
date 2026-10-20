import { Suspense } from "react";
import type { Metadata } from "next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Ganti Password · Generus" };

export default function PasswordPage() {
  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>Ganti password</CardTitle>
        <CardDescription>Minimal 8 karakter.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Suspense>
          <ForcedNotice />
        </Suspense>
        <PasswordForm />
      </CardContent>
    </Card>
  );
}

async function ForcedNotice() {
  const user = await getCurrentUser({ allowPasswordChange: true });
  if (!user.mustChangePassword) return null;
  return (
    <Alert>
      <AlertDescription>
        Anda masuk dengan password sementara. Silakan buat password baru sebelum melanjutkan.
      </AlertDescription>
    </Alert>
  );
}
