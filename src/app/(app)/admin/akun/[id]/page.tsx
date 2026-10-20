import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccount, listUnitGroups } from "@/lib/accounts";
import { requireSuperadmin, roleLabel } from "@/lib/auth";
import { removeRole, setActive } from "../actions";
import { AddRoleForm, ProfileForm, ResetPasswordForm } from "./forms";

export const metadata: Metadata = { title: "Detail Akun · Generus" };

export default function DetailPage({ params }: PageProps<"/admin/akun/[id]">) {
  return (
    <>
      <Link href="/admin/akun" className="text-sm text-muted-foreground hover:text-foreground">
        ← Kembali ke daftar akun
      </Link>
      <Suspense fallback={<p className="text-muted-foreground">Memuat…</p>}>
        <Detail params={params} />
      </Suspense>
    </>
  );
}

async function Detail({ params }: Pick<PageProps<"/admin/akun/[id]">, "params">) {
  const [me, { id }] = await Promise.all([requireSuperadmin(), params]);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [account, unitGroups] = await Promise.all([getAccount(me.claims, id), listUnitGroups(me.claims)]);
  if (!account) notFound();
  const isSelf = account.id === me.id;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">{account.name}</h1>
        {account.active ? <Badge variant="outline">Aktif</Badge> : <Badge variant="destructive">Nonaktif</Badge>}
        {account.mustChangePassword && <Badge variant="outline">Password sementara</Badge>}
      </div>
      <p className="-mt-4 text-sm text-muted-foreground">{account.email}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm id={account.id} name={account.name} phone={account.phone} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Peran</CardTitle>
            <CardDescription>Hak akses berlaku untuk unit tersebut dan seluruh unit di bawahnya.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {account.roles.length === 0 && <p className="text-sm text-muted-foreground">Belum punya peran.</p>}
            <ul className="flex flex-col gap-2">
              {account.roles.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <span>
                    {roleLabel(r)} · <span className="text-muted-foreground">{r.unitName}</span>
                  </span>
                  {!(isSelf && r.role === "superadmin") && (
                    <form action={removeRole}>
                      <input type="hidden" name="userId" value={account.id} />
                      <input type="hidden" name="roleId" value={r.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Hapus
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <AddRoleForm userId={account.id} unitGroups={unitGroups} />
          </CardContent>
        </Card>

        {!isSelf && (
          <Card>
            <CardHeader>
              <CardTitle>Keamanan</CardTitle>
              <CardDescription>
                Reset membuat password sementara baru. Menonaktifkan akun langsung memutus akses & login.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ResetPasswordForm id={account.id} email={account.email} />
              <form action={setActive}>
                <input type="hidden" name="id" value={account.id} />
                <input type="hidden" name="active" value={String(!account.active)} />
                <Button type="submit" variant={account.active ? "destructive" : "outline"}>
                  {account.active ? "Nonaktifkan akun" : "Aktifkan kembali"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
