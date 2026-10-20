"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TransitionKey } from "@/lib/kenaikan-rules";
import { promoteGenerus, type PromoteState } from "./actions";

export interface PromoteRow {
  id: string;
  name: string;
  gender: "L" | "P";
  age: number;
  school: string | null;
  kelompok: string;
  suggested: boolean;
}

export function PromoteForm({
  transition,
  targetLabel,
  rows,
}: {
  transition: TransitionKey;
  targetLabel: string;
  rows: PromoteRow[];
}) {
  const [state, action, pending] = useActionState<PromoteState, FormData>(promoteGenerus, {});
  return (
    <div className="flex flex-col gap-4">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.ok && (
        <Alert>
          <AlertDescription>{state.ok}</AlertDescription>
        </Alert>
      )}
      {/* key: setelah simpan, pilihan dibangun ulang dari daftar terbaru. */}
      <Checklist key={state.nonce} transition={transition} targetLabel={targetLabel} rows={rows} action={action} pending={pending} />
    </div>
  );
}

function Checklist({
  transition,
  targetLabel,
  rows,
  action,
  pending,
}: {
  transition: TransitionKey;
  targetLabel: string;
  rows: PromoteRow[];
  action: (fd: FormData) => void;
  pending: boolean;
}) {
  const [checked, setChecked] = useState(() => new Set(rows.filter((r) => r.suggested).map((r) => r.id)));
  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const suggestedCount = rows.filter((r) => r.suggested).length;

  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        if (!confirm(`Naikkan ${checked.size} generus ke ${targetLabel}?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="transition" value={transition} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {rows.length} calon · {suggestedCount} disarankan
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={() => setChecked(new Set(rows.filter((r) => r.suggested).map((r) => r.id)))}>
          Centang saran
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setChecked(new Set(rows.map((r) => r.id)))}>
          Centang semua
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setChecked(new Set())}>
          Kosongkan
        </Button>
      </div>

      <div className="max-h-[32rem] overflow-y-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <span className="sr-only">Pilih</span>
              </TableHead>
              <TableHead>Nama</TableHead>
              <TableHead className="w-16">Usia</TableHead>
              <TableHead className="hidden sm:table-cell">Sekolah / kelas</TableHead>
              <TableHead className="hidden md:table-cell">Kelompok</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => toggle(r.id)}>
                <TableCell>
                  <input
                    type="checkbox"
                    name="ids"
                    value={r.id}
                    checked={checked.has(r.id)}
                    onChange={() => toggle(r.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Pilih ${r.name}`}
                    className="size-4 accent-primary"
                  />
                </TableCell>
                <TableCell>
                  {r.name}
                  {r.suggested && (
                    <Badge variant="outline" className="ml-2">
                      disarankan
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{r.age}</TableCell>
                <TableCell className="hidden sm:table-cell">{r.school ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell">{r.kelompok}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button type="submit" className="w-fit" disabled={pending || checked.size === 0}>
        {pending ? "Menyimpan…" : `Naikkan ${checked.size} generus ke ${targetLabel}`}
      </Button>
    </form>
  );
}
