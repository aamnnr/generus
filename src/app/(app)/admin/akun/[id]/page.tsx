import { Suspense } from "react";
import type { Metadata } from "next";
import { BackLink, PageHeader, Pill } from "@/components/page-header";
import { initials } from "@/components/shell/nav";
import { notFound } from "next/navigation";
import { z } from "zod";
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
      <BackLink href="/admin/akun">Kembali ke daftar akun</BackLink>
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
      <div className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-bold text-secondary-foreground md:size-16">
          {initials(account.name)}
        </span>
        <PageHeader
          title={account.name}
          description={account.email}
          badges={
            <>
              {account.active ? <Pill tone="ok">Aktif</Pill> : <Pill tone="danger">Nonaktif</Pill>}
              {account.mustChangePassword && <Pill tone="muted">Password sementara</Pill>}
            </>
          }
        />
      </div>

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
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
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
