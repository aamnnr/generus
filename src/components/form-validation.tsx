"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircleIcon } from "lucide-react";

// Pengganti gelembung validasi bawaan browser ("Please fill out this field").
// Validasi HTML (required, min, type=email, …) tetap dipakai, tetapi pesannya
// ditampilkan dengan gaya aplikasi dan dalam Bahasa Indonesia. Dipasang sekali di layout akar.

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const fmtDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

function messageFor(f: Field): string {
  const v = f.validity;
  const type = f instanceof HTMLInputElement ? f.type : f.tagName.toLowerCase();
  const kind = f.dataset.kind ?? type;
  if (v.customError) return f.validationMessage;
  if (v.valueMissing) {
    if (f.dataset.requiredMessage) return f.dataset.requiredMessage;
    if (kind === "checkbox") return "Centang kotak ini untuk melanjutkan.";
    if (kind === "radio" || kind === "select" || kind === "pilihan") return "Pilih salah satu.";
    if (kind === "date" || kind === "tanggal") return "Pilih tanggal.";
    if (kind === "time" || kind === "jam") return "Pilih jam.";
    if (kind === "file") return "Pilih file terlebih dahulu.";
    return "Wajib diisi.";
  }
  if (v.typeMismatch) return type === "email" ? "Format email belum benar, contoh: nama@contoh.com." : "Format belum benar.";
  if (v.badInput) return kind === "number" ? "Masukkan angka yang benar." : "Isian belum benar.";
  const el = f as HTMLInputElement;
  if (v.tooShort) return `Minimal ${el.minLength} karakter (sekarang ${el.value.length}).`;
  if (v.tooLong) return `Maksimal ${el.maxLength} karakter.`;
  const isDate = kind === "date" || kind === "tanggal";
  if (v.rangeUnderflow) return isDate ? `Paling awal ${fmtDate(el.min)}.` : `Paling kecil ${el.min}.`;
  if (v.rangeOverflow) return isDate ? `Paling akhir ${fmtDate(el.max)}.` : `Paling besar ${el.max}.`;
  if (v.stepMismatch) return "Masukkan bilangan bulat.";
  if (v.patternMismatch) return f.dataset.patternMessage ?? "Format belum sesuai.";
  return "Isian belum benar.";
}

const isHiddenControl = (f: Field) => f.getAttribute("aria-hidden") === "true" || f.tabIndex === -1 || f.classList.contains("sr-only");

/** Elemen yang terlihat untuk ditunjuk & difokuskan (komponen kustom menyimpan nilainya di input tersembunyi). */
function anchorOf(f: Field): { anchor: HTMLElement; focus: HTMLElement } {
  const explicit = f.closest<HTMLElement>("[data-field-anchor]");
  if (explicit) {
    const focus = explicit.querySelector<HTMLElement>("button:not([tabindex='-1']), input:not([aria-hidden='true']):not([type=hidden]), [tabindex='0']") ?? explicit;
    return { anchor: explicit, focus };
  }
  if (isHiddenControl(f)) {
    // Radio/checkbox sr-only di dalam label bergaya tombol → tunjuk grup/label-nya.
    const group = f.closest<HTMLElement>("[role=radiogroup], fieldset") ?? f.closest("label") ?? f.parentElement!;
    return { anchor: group, focus: (f.closest("label") as HTMLElement | null) ?? group };
  }
  return { anchor: f, focus: f };
}

interface Bubble {
  text: string;
  anchor: HTMLElement;
}

export function FormValidation() {
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; above: boolean } | null>(null);
  const shownAt = useRef(0);

  useEffect(() => {
    let firstThisTick = true;
    const onInvalid = (e: Event) => {
      const f = e.target as Field;
      if (!(f instanceof HTMLInputElement || f instanceof HTMLSelectElement || f instanceof HTMLTextAreaElement)) return;
      e.preventDefault(); // tanpa gelembung bawaan
      const { anchor, focus } = anchorOf(f);
      const mark = isHiddenControl(f) ? focus : f;
      mark.setAttribute("aria-invalid", "true");
      const clear = () => {
        mark.removeAttribute("aria-invalid");
        setBubble((b) => (b?.anchor === anchor ? null : b));
      };
      if (isHiddenControl(f)) {
        // Nilai komponen kustom diubah lewat React (tanpa event input) → periksa ulang berkala.
        const timer = setInterval(() => {
          if (!f.isConnected || f.validity.valid) {
            clearInterval(timer);
            clear();
          }
        }, 250);
      } else {
        f.addEventListener("input", clear, { once: true });
        f.addEventListener("change", clear, { once: true });
      }
      if (!firstThisTick) return;
      firstThisTick = false;
      setTimeout(() => (firstThisTick = true), 0);
      anchor.scrollIntoView({ block: "center", behavior: "smooth" });
      focus.focus({ preventScroll: true });
      shownAt.current = Date.now();
      setBubble({ text: messageFor(f), anchor });
    };
    document.addEventListener("invalid", onInvalid, true);
    return () => document.removeEventListener("invalid", onInvalid, true);
  }, []);

  useEffect(() => {
    if (!bubble) return;
    const place = () => {
      const r = bubble.anchor.getBoundingClientRect();
      if (!r.width && !r.height) return setBubble(null);
      const above = r.bottom + 64 > window.innerHeight;
      setPos({ top: above ? r.top - 8 : r.bottom + 8, left: Math.max(16, Math.min(r.left, window.innerWidth - 296)), width: r.width, above });
    };
    place();
    const hide = () => Date.now() - shownAt.current > 400 && setBubble(null);
    const timer = setTimeout(() => setBubble(null), 6000);
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(place);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    document.addEventListener("pointerdown", hide);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setBubble(null);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("keydown", onKey);
    };
  }, [bubble]);

  if (!bubble || !pos) return null;
  return createPortal(
    <div
      role="alert"
      className="animate-enter pointer-events-none fixed z-[95] flex max-w-[280px] items-start gap-2 rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background shadow-float"
      style={{ top: pos.top, left: pos.left, transform: pos.above ? "translateY(-100%)" : undefined }}
    >
      <span
        aria-hidden
        className="absolute left-4 size-2.5 rotate-45 rounded-[2px] bg-foreground"
        style={pos.above ? { bottom: -4 } : { top: -4 }}
      />
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-[oklch(0.8_0.12_60)]" aria-hidden />
      <span>{bubble.text}</span>
    </div>,
    document.body,
  );
}
