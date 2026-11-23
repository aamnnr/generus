import { Suspense } from "react";
import type { Metadata } from "next";
import { LOGO_COLORS, LogoGlyph } from "@/components/brand/logo";
import { brand, isKliik } from "@/lib/brand";
import { MosqueSilhouette } from "@/components/shell/ornament";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

// DESIGN.md §8.5: HP = panel hijau di atas + kartu form; desktop = dua panel.
export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-background lg:flex-row">
      <section className="relative flex h-[42vh] min-h-72 flex-col items-center justify-center gap-3 overflow-hidden bg-hero text-hero-foreground lg:h-auto lg:min-h-dvh lg:flex-1">
        {isKliik ? (
          <>
            <h1 className="sr-only">{brand.fullName}</h1>
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG statis */}
            <img src="/brand/kliik-jm-logo-putih.svg" alt="" className="relative w-[min(78%,26rem)] -translate-y-3 lg:w-[min(70%,32rem)]" />
          </>
        ) : (
          <>
            <MosqueSilhouette className="absolute -bottom-10 left-1/2 w-[110%] max-w-3xl -translate-x-1/2 opacity-10" />
            <LogoGlyph variant="full" mosque={LOGO_COLORS.cream} id="login-logo" title="Logo Generus" className="relative size-28 lg:size-36" />
            <h1 className="font-heading text-[40px] leading-[46px] font-semibold lg:text-5xl">{brand.name}</h1>
            <p className="text-sm tracking-[0.04em] text-white/80">Presensi · Materi · Kitab</p>
          </>
        )}
      </section>

      <section className="relative -mt-8 flex flex-1 items-start justify-center px-4 pb-10 lg:mt-0 lg:items-center lg:px-12">
        <div className="flex w-full max-w-sm flex-col gap-5 rounded-[20px] bg-card p-6 shadow-float lg:shadow-none lg:bg-transparent lg:p-0">
          <div>
            <h2 className="text-[22px] leading-7 font-bold">Assalamu&apos;alaikum</h2>
            <p className="text-sm text-muted-foreground">Masuk dengan akun dari admin daerah.</p>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
          <p className="text-center text-[13px] text-muted-foreground">Belum punya akun atau lupa password? Hubungi superadmin daerah.</p>
        </div>
      </section>
    </main>
  );
}
