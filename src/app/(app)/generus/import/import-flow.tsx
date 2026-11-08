"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "@/components/app-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { FileSpreadsheetIcon, UploadIcon } from "lucide-react";
import { cn } from "cn";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ImportRow } from "@/lib/import/generus-import";
import { commitImport, previewImport, type ImportState } from "./actions";

export function ImportFlow() {
  // File disimpan di state: React mengosongkan <input type="file"> setelah action,
  // padahal file yang sama perlu dikirim lagi saat konfirmasi.
  const [file, setFile] = useState<File | null>(null);
  const [preview, runPreview, previewing] = useActionState<ImportState, FormData>(previewImport, { step: "upload" });
  const [result, runCommit, committing] = useActionState<ImportState, FormData>(commitImport, { step: "upload" });
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const busy = previewing || committing;

  const send = (action: (fd: FormData) => void) => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    startTransition(() => action(fd));
  };

  if (result.step === "done") {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <AlertTitle>{result.imported?.toLocaleString("id-ID")} generus berhasil diimport</AlertTitle>
          <AlertDescription>
            Dari {result.fileName}. {result.counts?.duplikat ? `${result.counts.duplikat} baris duplikat dilewati. ` : ""}
            {result.counts?.error ? `${result.counts.error} baris bermasalah tidak diimport.` : ""}
          </AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Link href="/generus" className={buttonVariants()}>
            Lihat daftar generus
          </Link>
          <Button variant="outline" onClick={() => location.reload()}>
            Import file lain
          </Button>
        </div>
      </div>
    );
  }

  const error = result.error ?? preview.error;
  const showPreview = preview.step === "preview" && !!file && preview.fileName === file.name;
  const counts = preview.counts;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          send(runPreview);
        }}
      >
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f && f.name.toLowerCase().endsWith(".xlsx")) setFile(f);
          }}
          className={cn(
            "tap flex min-h-14 flex-1 cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
            dragging ? "border-primary bg-secondary" : file ? "border-primary/40 bg-card" : "border-border bg-card hover:border-primary/40 hover:bg-secondary/40",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            aria-label="File Excel"
            className="sr-only"
          />
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-tile text-primary">
            {file ? <FileSpreadsheetIcon className="size-5" aria-hidden /> : <UploadIcon className="size-5" aria-hidden />}
          </span>
          <span className="flex min-w-0 flex-col leading-snug">
            {file ? (
              <>
                <span className="truncate text-sm font-semibold">{file.name}</span>
                <span className="text-xs text-muted-foreground">{(file.size / 1024).toLocaleString("id-ID", { maximumFractionDigits: 0 })} KB · klik untuk ganti file</span>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold">Pilih file Excel (.xlsx)</span>
                <span className="text-xs text-muted-foreground">Klik di sini, atau seret file ke kotak ini</span>
              </>
            )}
          </span>
        </label>
        <Button type="submit" variant="outline" disabled={!file || busy}>
          {previewing ? "Memeriksa…" : "Periksa file"}
        </Button>
      </form>

      {showPreview && counts && (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">{counts.ok} siap diimport</Badge>
            {counts.duplikat > 0 && <Badge variant="outline">{counts.duplikat} duplikat (dilewati)</Badge>}
            {counts.error > 0 && <Badge variant="destructive">{counts.error} bermasalah</Badge>}
          </div>

          {preview.problems && preview.problems.length > 0 && (
            <RowTable title="Perlu diperbaiki / dilewati" rows={preview.problems} showMessage />
          )}
          {preview.sample && preview.sample.length > 0 && (
            <RowTable
              title={counts.ok > preview.sample.length ? `Contoh ${preview.sample.length} dari ${counts.ok} baris siap` : "Baris siap"}
              rows={preview.sample}
            />
          )}

          {counts.error > 0 && (
            <p className="text-sm text-muted-foreground">
              Baris bermasalah tidak akan diimport. Perbaiki di Excel lalu periksa ulang, atau lanjutkan untuk
              mengimport baris yang siap saja.
            </p>
          )}
          <Button className="w-fit" disabled={counts.ok === 0 || busy} onClick={() => send(runCommit)}>
            {committing ? "Menyimpan…" : `Simpan ${counts.ok.toLocaleString("id-ID")} generus`}
          </Button>
        </>
      )}
    </div>
  );
}

function RowTable({ title, rows, showMessage }: { title: string; rows: ImportRow[]; showMessage?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="max-h-80 overflow-y-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Baris</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead className="hidden sm:table-cell">Kelompok</TableHead>
              {showMessage ? <TableHead>Keterangan</TableHead> : <TableHead>Jenjang</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.row}>
                <TableCell className="tabular-nums">{r.row}</TableCell>
                <TableCell>{r.name || "—"}</TableCell>
                <TableCell className="hidden sm:table-cell">{r.kelompok || "—"}</TableCell>
                <TableCell className={showMessage && r.status === "error" ? "text-destructive" : undefined}>
                  {showMessage ? r.message : r.jenjang}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
