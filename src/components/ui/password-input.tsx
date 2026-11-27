"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "cn";

/**
 * Kolom password dengan tombol lihat/sembunyikan. Atribut lain sama seperti <Input>.
 * Tombol tidak ikut urutan submit form (type="button") dan tetap bisa dipakai dengan keyboard.
 */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-12", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        aria-pressed={visible}
        aria-controls={props.id}
        className="tap absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {visible ? <EyeOffIcon className="size-[18px]" aria-hidden /> : <EyeIcon className="size-[18px]" aria-hidden />}
      </button>
    </div>
  );
}
