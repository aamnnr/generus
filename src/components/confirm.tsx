"use client";

import { useSyncExternalStore, type FormEvent } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { AlertTriangleIcon, HelpCircleIcon } from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";

// Dialog konfirmasi milik aplikasi (pengganti window.confirm). Satu <ConfirmHost/> dipasang
// di layout akar; komponen mana pun cukup memanggil `confirmDialog({...})` atau
// `confirmSubmit({...})` untuk form.

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Aksi yang menghapus/mengunci/tidak bisa dibatalkan → tombol merah. */
  destructive?: boolean;
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

let current: Pending | null = null;
let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  current?.resolve(false);
  return new Promise((resolve) => {
    current = { ...opts, resolve };
    open = true;
    emit();
  });
}

function settle(ok: boolean) {
  if (!current || !open) return;
  current.resolve(ok);
  open = false;
  emit();
}

/**
 * onSubmit untuk form yang perlu konfirmasi. Pengiriman ditahan, dialog tampil, lalu
 * form dikirim ulang (dengan tombol pengirim yang sama) bila pengguna setuju.
 */
export function confirmSubmit(opts: ConfirmOptions) {
  return (e: FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    if (form.dataset.confirmed === "1") {
      delete form.dataset.confirmed;
      return;
    }
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    void confirmDialog(opts).then((ok) => {
      if (!ok || !form.isConnected) return;
      form.dataset.confirmed = "1";
      form.requestSubmit(submitter && submitter.form === form ? submitter : undefined);
    });
  };
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function ConfirmHost() {
  const isOpen = useSyncExternalStore(subscribe, () => open, () => false);
  const opts = useSyncExternalStore(subscribe, () => current, () => null);
  const destructive = opts?.destructive;
  const Icon = destructive ? AlertTriangleIcon : HelpCircleIcon;
  return (
    <AlertDialog.Root open={isOpen} onOpenChange={(o) => !o && settle(false)}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-[90] bg-foreground/30 backdrop-blur-[2px] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed bottom-0 left-1/2 z-[91] flex w-full max-w-md -translate-x-1/2 flex-col gap-4 rounded-t-3xl bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-card-foreground shadow-float outline-none transition-[opacity,transform] duration-200 data-ending-style:translate-y-4 data-ending-style:opacity-0 data-starting-style:translate-y-4 data-starting-style:opacity-0 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:rounded-3xl sm:p-6 sm:data-ending-style:translate-y-[-46%] sm:data-starting-style:translate-y-[-46%]">
          <div className="flex items-start gap-3.5">
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                destructive ? "bg-status-alpa-soft text-destructive" : "bg-tile text-primary",
              )}
            >
              <Icon className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col gap-1 pt-0.5">
              <AlertDialog.Title className="text-lg leading-snug font-bold">{opts?.title}</AlertDialog.Title>
              {opts?.description && <AlertDialog.Description className="text-sm text-muted-foreground">{opts.description}</AlertDialog.Description>}
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Close className={cn(buttonVariants({ variant: "outline" }), "tap")}>{opts?.cancelLabel ?? "Batal"}</AlertDialog.Close>
            <button
              type="button"
              autoFocus
              onClick={() => settle(true)}
              className={cn(
                buttonVariants({ variant: "default" }),
                "tap",
                destructive && "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30",
              )}
            >
              {opts?.confirmLabel ?? "Ya, lanjutkan"}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
