import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "@/components/app-link";
import { ChevronRight, Plus, Search } from "lucide-react";
import { EmptyState, PageHeader, Pill } from "@/components/page-header";
import { initials } from "@/components/shell/nav";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAccounts, type AccountRow } from "@/lib/accounts";
import { requireSuperadmin, roleLabel } from "@/lib/auth";
import { PageLoading } from "@/components/page-loading";

export const metadata: Metadata = { title: "Akun · Generus" };

export default function AkunPage({ searchParams }: PageProps<"/admin/akun">) {
  return (
    <>
      <PageHeader
        title="Akun & peran"
        description="Akun admin, kyai, tim kurikulum, dan petugas."
        actions={
          <Link href="/admin/akun/baru" className={buttonVariants()}>
            <Plus aria-hidden /> Tambah akun
          </Link>
        }
      />
      <Suspense fallback={<PageLoading />}>
        <AccountList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function StatusPills({ a }: { a: AccountRow }) {
  return (
    <>
      {a.active ? <Pill tone="ok">Aktif</Pill> : <Pill tone="danger">Nonaktif</Pill>}
      {a.mustChangePassword && <Pill tone="muted">Password sementara</Pill>}
    </>
  );
}

async function AccountList({ searchParams }: Pick<PageProps<"/admin/akun">, "searchParams">) {
  const [me, params] = await Promise.all([requireSuperadmin(), searchParams]);
  const q = typeof params.q === "string" ? params.q : "";
  const accounts = await listAccounts(me.claims, q);

  return (
    <>
      <form role="search" className="flex">
        <label className="flex h-11 w-full items-center gap-2 rounded-full border border-border bg-card px-4 text-muted-foreground md:h-10 md:max-w-sm">
          <Search className="size-[18px] shrink-0" aria-hidden />
          <input
            name="q"
            defaultValue={q}
            placeholder="Cari nama atau email"
            aria-label="Cari nama atau email"
            className="w-full min-w-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground md:text-[15px]"
          />
        </label>
      </form>

      {accounts.length === 0 && <EmptyState title="Tidak ada akun yang cocok" />}

      {/* HP: kartu */}
      <ul className="flex flex-col gap-2 md:hidden">
        {accounts.map((a) => (
          <li key={a.id}>
            <Link href={`/admin/akun/${a.id}`} className="flex items-start gap-3 rounded-2xl bg-card p-3.5 shadow-card">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
                {initials(a.name)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-semibold">{a.name}</span>
                <span className="truncate text-[13px] text-muted-foreground">{a.email}</span>
                <span className="flex flex-wrap gap-1">
                  {a.roles.map((r) => (
                    <Pill key={r.id}>
                      {roleLabel(r)} · {r.unitName}
                    </Pill>
                  ))}
                  <StatusPills a={a} />
                </span>
              </span>
              <ChevronRight className="mt-3 size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop: tabel */}
      {accounts.length > 0 && (
        <div className="hidden overflow-x-auto rounded-2xl bg-card shadow-card md:block">
          <Table>
            <TableHeader>
              <TableRow className="text-xs tracking-wide">
                <TableHead className="pl-4">NAMA</TableHead>
                <TableHead>EMAIL</TableHead>
                <TableHead>PERAN</TableHead>
                <TableHead>STATUS</TableHead>
                <TableHead className="w-10 pr-4">
                  <span className="sr-only">Buka</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id} className="relative cursor-pointer hover:bg-secondary/50">
                  <TableCell className="pl-4">
                    <Link href={`/admin/akun/${a.id}`} className="flex items-center gap-3 font-semibold after:absolute after:inset-0 after:content-['']">
                      <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                        {initials(a.name)}
                      </span>
                      {a.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {a.roles.map((r) => (
                        <Pill key={r.id}>
                          {roleLabel(r)} · {r.unitName}
                        </Pill>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <StatusPills a={a} />
                    </div>
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <ChevronRight className="inline size-[18px] text-muted-foreground" aria-hidden />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
