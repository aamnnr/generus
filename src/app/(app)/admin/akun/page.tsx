import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAccounts } from "@/lib/accounts";
import { requireSuperadmin, roleLabel } from "@/lib/auth";

export const metadata: Metadata = { title: "Akun · Generus" };

export default function AkunPage({ searchParams }: PageProps<"/admin/akun">) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Akun & peran</h1>
        <Link href="/admin/akun/baru" className={buttonVariants()}>
          Tambah akun
        </Link>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Memuat…</p>}>
        <AccountList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function AccountList({ searchParams }: Pick<PageProps<"/admin/akun">, "searchParams">) {
  const [me, params] = await Promise.all([requireSuperadmin(), searchParams]);
  const q = typeof params.q === "string" ? params.q : "";
  const accounts = await listAccounts(me.claims, q);

  return (
    <>
      <form className="flex gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Cari nama atau email" className="max-w-xs" />
      </form>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Tidak ada akun.
                </TableCell>
              </TableRow>
            )}
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Link href={`/admin/akun/${a.id}`} className="font-medium underline-offset-4 hover:underline">
                    {a.name}
                  </Link>
                  <div className="text-xs text-muted-foreground md:hidden">{a.email}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{a.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {a.roles.map((r) => (
                      <Badge key={r.id} variant="secondary" className="whitespace-normal">
                        {roleLabel(r)} · {r.unitName}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {a.active ? <Badge variant="outline">Aktif</Badge> : <Badge variant="destructive">Nonaktif</Badge>}
                    {a.mustChangePassword && <Badge variant="outline">Password sementara</Badge>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
