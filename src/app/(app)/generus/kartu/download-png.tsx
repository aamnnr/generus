"use client";

import { useState } from "react";
import { ImageDownIcon, QrCodeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Unduh kartu / QR satu generus sebagai PNG. Kartu digambar ulang di canvas dengan
// posisi & gaya diambil dari kartu yang sedang tampil (jadi hasilnya sama persis),
// memakai font halaman yang sudah dimuat. Tanpa server, tanpa pustaka tambahan.

const CARD_WIDTH_PX = 1080; // ±20 px/mm untuk kartu 54 mm → tajam saat dicetak ulang
const QR_SIZE_PX = 1000;

const px = (v: string) => parseFloat(v) || 0;

function svgImage(svg: SVGElement, color?: string): Promise<HTMLImageElement> {
  let text = new XMLSerializer().serializeToString(svg);
  if (!text.includes("xmlns=")) text = text.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  if (color) text = text.replaceAll("currentColor", color);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal memuat gambar SVG"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

/** Pecah teks per baris sesuai lebar (ctx.font harus sudah diatur). */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width + 0.5 || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function renderCard(card: HTMLElement): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const R = card.getBoundingClientRect();
  const k = CARD_WIDTH_PX / R.width;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(R.width * k);
  canvas.height = Math.round(R.height * k);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(k, k);
  const rel = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.left - R.left, y: r.top - R.top, w: r.width, h: r.height };
  };
  const $ = <T extends Element = HTMLElement>(sel: string) => card.querySelector<T>(sel)!;

  // Bentuk kartu
  const cs = getComputedStyle(card);
  roundRect(ctx, 0, 0, R.width, R.height, px(cs.borderTopLeftRadius));
  ctx.clip();
  ctx.fillStyle = cs.backgroundColor;
  ctx.fillRect(0, 0, R.width, R.height);

  // Kepala kartu: latar hijau dengan tepi bawah melengkung (border-radius 50% / 4mm)
  const top = $(".idc-top");
  const t = rel(top);
  const ts = getComputedStyle(top);
  const [rx, ry = rx] = ts.borderBottomRightRadius.split(" ").map(px);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(t.x, t.y);
  ctx.lineTo(t.x + t.w, t.y);
  ctx.lineTo(t.x + t.w, t.y + t.h - ry);
  ctx.ellipse(t.x + t.w - rx, t.y + t.h - ry, rx, ry, 0, 0, Math.PI / 2);
  ctx.lineTo(t.x + rx, t.y + t.h);
  ctx.ellipse(t.x + rx, t.y + t.h - ry, rx, ry, 0, Math.PI / 2, Math.PI);
  ctx.closePath();
  ctx.fillStyle = ts.backgroundColor;
  ctx.fill();
  ctx.clip();
  const star = $<SVGElement>(".idc-star");
  const s = rel(star);
  ctx.drawImage(await svgImage(star, getComputedStyle(star).color), s.x, s.y, s.w, s.h);
  ctx.restore();

  // Lubang tali
  const slot = $(".idc-slot");
  const sl = rel(slot);
  const ss = getComputedStyle(slot);
  const bw = px(ss.borderTopWidth);
  roundRect(ctx, sl.x + bw / 2, sl.y + bw / 2, sl.w - bw, sl.h - bw, px(ss.borderTopLeftRadius));
  ctx.strokeStyle = ss.borderTopColor;
  ctx.lineWidth = bw;
  ctx.stroke();

  // Logo
  const mark = $<SVGElement>(".idc-mark");
  const m = rel(mark);
  ctx.drawImage(await svgImage(mark), m.x, m.y, m.w, m.h);

  /** Tulis teks elemen di posisinya (rata tengah vertikal per baris, perataan mengikuti CSS). */
  const text = (el: HTMLElement, opts: { multiline?: boolean } = {}) => {
    const st = getComputedStyle(el);
    const r = rel(el);
    const padL = px(st.paddingLeft);
    const padR = px(st.paddingRight);
    ctx.save();
    ctx.globalAlpha = Number(st.opacity);
    ctx.font = `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
    ctx.fillStyle = st.color;
    if ("letterSpacing" in ctx) ctx.letterSpacing = st.letterSpacing === "normal" ? "0px" : st.letterSpacing;
    ctx.textBaseline = "middle";
    const centered = st.textAlign === "center" || st.display.includes("flex") || el.closest(".idc-body") !== null;
    ctx.textAlign = centered ? "center" : "left";
    const content = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    const width = r.w - padL - padR;
    const lines = opts.multiline ? wrap(ctx, content, width) : [content];
    const lh = st.lineHeight === "normal" ? px(st.fontSize) * 1.2 : px(st.lineHeight);
    const startY = r.y + r.h / 2 - ((lines.length - 1) * lh) / 2;
    const x = centered ? r.x + padL + width / 2 : r.x + padL;
    lines.forEach((line, i) => ctx.fillText(line, x, startY + i * lh));
    ctx.restore();
  };

  text($(".idc-app"));
  text($(".idc-daerah"));
  text($(".idc-name"), { multiline: true });
  text($(".idc-meta"), { multiline: true });

  // Label jenjang
  const pill = $(".idc-pill");
  const p = rel(pill);
  roundRect(ctx, p.x, p.y, p.w, p.h, p.h / 2);
  ctx.fillStyle = getComputedStyle(pill).backgroundColor;
  ctx.fill();
  text(pill);

  // Kotak QR
  const qrBox = $(".idc-qr");
  const q = rel(qrBox);
  const qs = getComputedStyle(qrBox);
  roundRect(ctx, q.x, q.y, q.w, q.h, px(qs.borderTopLeftRadius));
  ctx.fillStyle = qs.backgroundColor;
  ctx.fill();
  const qb = px(qs.borderTopWidth);
  roundRect(ctx, q.x + qb / 2, q.y + qb / 2, q.w - qb, q.h - qb, px(qs.borderTopLeftRadius));
  ctx.strokeStyle = qs.borderTopColor;
  ctx.lineWidth = qb;
  ctx.stroke();
  const qrSvg = qrBox.querySelector("svg")!;
  const qi = rel(qrSvg);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(await svgImage(qrSvg), qi.x, qi.y, qi.w, qi.h);
  ctx.imageSmoothingEnabled = true;

  text($(".idc-token"));

  // Kaki kartu
  const foot = $(".idc-foot");
  const f = rel(foot);
  ctx.fillStyle = getComputedStyle(foot).backgroundColor;
  ctx.fillRect(f.x, f.y, f.w, f.h);
  text(foot);

  return canvas;
}

async function renderQr(card: HTMLElement, name: string, token: string): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const pad = 140; // zona kosong ≥ 4 modul di sekeliling QR (standar pemindai)
  const canvas = document.createElement("canvas");
  canvas.width = QR_SIZE_PX + pad * 2;
  canvas.height = QR_SIZE_PX + pad * 2 + 150;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(await svgImage(card.querySelector<SVGElement>(".idc-qr svg")!), pad, pad, QR_SIZE_PX, QR_SIZE_PX);
  const family = getComputedStyle(card.querySelector(".idc-name")!).fontFamily;
  const mono = getComputedStyle(card.querySelector(".idc-token")!).fontFamily;
  ctx.fillStyle = "#171717";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 64;
  ctx.font = `600 ${size}px ${family}`;
  while (ctx.measureText(name).width > canvas.width - pad * 2 && size > 28) ctx.font = `600 ${(size -= 2)}px ${family}`;
  ctx.fillText(name, canvas.width / 2, QR_SIZE_PX + pad + 60);
  ctx.fillStyle = "#525252";
  ctx.font = `40px ${mono}`;
  ctx.fillText(token.match(/.{1,4}/g)?.join(" ") ?? token, canvas.width / 2, QR_SIZE_PX + pad + 125);
  return canvas;
}

function save(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Gagal membuat gambar"));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      resolve();
    }, "image/png"),
  );
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim() || "generus";

export function DownloadPng({ name, token }: { name: string; token: string }) {
  const [busy, setBusy] = useState<"kartu" | "qr" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "kartu" | "qr") {
    const card = document.querySelector<HTMLElement>(".kartu-sheet .idc");
    if (!card) return;
    setBusy(kind);
    setError(null);
    try {
      const canvas = kind === "kartu" ? await renderCard(card) : await renderQr(card, name, token);
      await save(canvas, `${kind === "kartu" ? "Kartu" : "QR"} - ${safeName(name)}.png`);
    } catch {
      setError("Gambar gagal dibuat. Coba lagi, atau gunakan Cetak / simpan PDF.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => run("kartu")} disabled={busy !== null}>
        <ImageDownIcon aria-hidden /> {busy === "kartu" ? "Membuat gambar…" : "Unduh kartu (PNG)"}
      </Button>
      <Button variant="outline" onClick={() => run("qr")} disabled={busy !== null}>
        <QrCodeIcon aria-hidden /> {busy === "qr" ? "Membuat gambar…" : "Unduh QR (PNG)"}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </>
  );
}
