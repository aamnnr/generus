import { Suspense } from "react";
import type { Metadata } from "next";
import { BackLink, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { listUnitGroups } from "@/lib/accounts";
import { requireSuperadmin } from "@/lib/auth";
import { CreateAccountForm } from "./create-form";

export const metadata: Metadata = { title: "Tambah Akun · Generus" };

export default function BaruPage() {
  return (
    <>
      <BackLink href="/admin/akun">Kembali ke daftar akun</BackLink>
      <PageHeader title="Tambah akun" description="Sistem membuat password sementara yang wajib diganti saat pemilik akun pertama kali masuk." />
      <Card className="max-w-3xl">
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
