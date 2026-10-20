import { Suspense } from "react";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk · Generus" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Masuk</CardTitle>
          <CardDescription>Pemantauan Ketertiban Generus</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <LoginForm />
          </Suspense>
          <p className="mt-6 text-xs text-muted-foreground">
            Belum punya akun atau lupa password? Hubungi superadmin daerah.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
