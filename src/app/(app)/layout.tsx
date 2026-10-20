import { Suspense } from "react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { canReadGenerus, getCurrentUser } from "@/lib/auth";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/beranda" className="font-semibold">
            Generus
          </Link>
          <Suspense fallback={<div className="ml-auto h-7" />}>
            <UserNav />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6">{children}</main>
    </div>
  );
}

async function UserNav() {
  const user = await getCurrentUser({ allowPasswordChange: true });
  return (
    <>
      <nav className="flex items-center gap-1 text-sm">
        <Link href="/beranda" className="rounded-md px-2 py-1 hover:bg-muted">
          Beranda
        </Link>
        {canReadGenerus(user) && (
          <Link href="/generus" className="rounded-md px-2 py-1 hover:bg-muted">
            Generus
          </Link>
        )}
        {user.isSuperadmin && (
          <>
            <Link href="/admin/wilayah" className="rounded-md px-2 py-1 hover:bg-muted">
              Wilayah
            </Link>
            <Link href="/admin/akun" className="rounded-md px-2 py-1 hover:bg-muted">
              Akun
            </Link>
          </>
        )}
      </nav>
      <div className="ml-auto flex items-center gap-2 text-sm">
        <Link href="/akun/password" className="hidden text-muted-foreground hover:text-foreground sm:inline">
          {user.name}
        </Link>
        <form action={logout}>
          <Button type="submit" variant="outline" size="sm">
            Keluar
          </Button>
        </form>
      </div>
    </>
  );
}
