import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listUnitGroups } from "@/lib/accounts";
import { requireSuperadmin } from "@/lib/auth";
import { CreateAccountForm } from "./create-form";

export const metadata: Metadata = { title: "Tambah Akun · Generus" };

export default function BaruPage() {
  return (
    <>
      <Link href="/admin/akun" className="text-sm text-muted-foreground hover:text-foreground">
        ← Kembali ke daftar akun
      </Link>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Tambah akun</CardTitle>
          <CardDescription>
            Sistem membuat password sementara yang wajib diganti saat pemilik akun pertama kali masuk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-muted-foreground">Memuat…</p>}>
            <FormLoader />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}

async function FormLoader() {
  const me = await requireSuperadmin();
  return <CreateAccountForm unitGroups={await listUnitGroups(me.claims)} />;
}
