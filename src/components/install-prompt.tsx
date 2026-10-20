"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "generus:install-dismissed";

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Ajakan memasang aplikasi ke layar utama. Android/Chrome: tombol pasang
 * (event beforeinstallprompt). iPhone/iPad: petunjuk lewat menu Bagikan,
 * karena Safari tidak punya tombol pasang otomatis.
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<"hidden" | "button" | "ios">("hidden");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || readDismissed()) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deteksi platform hanya bisa di browser
    if (isIos) setMode("ios");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("button");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "hidden") return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Tanpa penyimpanan, kartu muncul lagi di kunjungan berikutnya.
    }
    setMode("hidden");
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1 text-sm">
          <p className="font-medium">Pasang Generus di HP</p>
          {mode === "ios" ? (
            <p className="text-muted-foreground">
              Ketuk tombol <span className="font-medium text-foreground">Bagikan</span> di Safari, lalu pilih{" "}
              <span className="font-medium text-foreground">Tambah ke Layar Utama</span>.
            </p>
          ) : (
            <p className="text-muted-foreground">Buka lebih cepat dari layar utama, seperti aplikasi biasa.</p>
          )}
        </div>
        <div className="flex gap-2">
          {mode === "button" && deferred && (
            <Button
              onClick={async () => {
                await deferred.prompt();
                const { outcome } = await deferred.userChoice;
                if (outcome === "accepted") setMode("hidden");
                setDeferred(null);
              }}
            >
              Pasang aplikasi
            </Button>
          )}
          <Button variant="ghost" onClick={dismiss}>
            Nanti saja
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
